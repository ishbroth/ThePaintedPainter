import Capacitor
import Speech
import AVFoundation

/**
 * Wraps Apple's own on-device Speech framework (the same engine behind dictation and Siri) so the web layer can run a
 * real back-and-forth conversation: start listening, get live partial text as the words are recognized, and let the
 * engine's own end-of-speech detection decide when a pause means the person is done — no silence timer of our own.
 *
 * `start` resolves once with the final transcript when that happens (or when `stop` is called early). Only one turn
 * runs at a time; starting a new one while another is active ends the previous one first.
 */
@objc(LocalSpeechPlugin)
public class LocalSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LocalSpeechPlugin"
    public let jsName = "LocalSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private let audioEngine = AVAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var activeCall: CAPPluginCall?
    private var lastHeard = ""

    @objc func available(_ call: CAPPluginCall) {
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
        call.resolve(["available": recognizer?.isAvailable ?? false])
    }

    @objc public override func checkPermissions(_ call: CAPPluginCall) {
        call.resolve(["speechRecognition": permissionState()])
    }

    @objc public override func requestPermissions(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { [weak self] _ in
            AVAudioSession.sharedInstance().requestRecordPermission { _ in
                DispatchQueue.main.async {
                    call.resolve(["speechRecognition": self?.permissionState() ?? "denied"])
                }
            }
        }
    }

    private func permissionState() -> String {
        let speech = SFSpeechRecognizer.authorizationStatus()
        let mic = AVAudioSession.sharedInstance().recordPermission
        if speech == .authorized && mic == .granted { return "granted" }
        if speech == .denied || speech == .restricted || mic == .denied { return "denied" }
        return "prompt"
    }

    @objc func start(_ call: CAPPluginCall) {
        // kept open until the engine (or a later stop() call) resolves it — this is one long turn, not a quick request
        call.keepAlive = true
        endTurn(resolveWith: nil) // a previous turn left running is ended (not resolved a second time) before this one begins

        let language = call.getString("language") ?? "en-US"
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language)) ?? SFSpeechRecognizer()
        guard let recognizer = recognizer, recognizer.isAvailable else {
            call.reject("Speech recognizer is not available right now")
            return
        }
        self.recognizer = recognizer
        self.activeCall = call
        self.lastHeard = ""

        let session = AVAudioSession.sharedInstance()
        do {
            // .duckOthers rather than fully interrupting: belt-and-suspenders alongside the web layer's own rule of
            // never starting a turn while the reply is still being spoken.
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            call.reject("Could not open the microphone: \(error.localizedDescription)")
            activeCall = nil
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }
        self.request = request

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            call.reject("Could not start listening: \(error.localizedDescription)")
            activeCall = nil
            return
        }

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self = self else { return }
            if let result = result {
                let text = result.bestTranscription.formattedString
                self.lastHeard = text
                self.notifyListeners("partialResults", data: ["matches": [text]])
                if result.isFinal {
                    self.endTurn(resolveWith: text)
                }
            }
            if error != nil {
                // the engine gave up (silence from the very start, or it was interrupted) — resolve with whatever was heard, if anything
                self.endTurn(resolveWith: self.lastHeard)
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        endTurn(resolveWith: lastHeard)
        call.resolve()
    }

    /** Tears down the engine/session and, if a start() call is still waiting, resolves it. Safe to call when nothing is running. */
    private func endTurn(resolveWith matches: String?) {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

        if let call = activeCall {
            activeCall = nil
            if let matches = matches {
                call.resolve(["matches": [matches]])
            } else {
                call.resolve(["matches": []])
            }
        }
    }
}
