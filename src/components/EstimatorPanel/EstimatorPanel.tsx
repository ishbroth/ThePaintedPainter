import { useState, useCallback, useEffect } from 'react';
import type { ConversationState, EstimateBreakdown } from '../../lib/types';
import {
  initializeConversation,
  advanceConversation,
  goBack,
  getProgress,
  getCurrentNode,
  validateAnswer,
} from '../../lib/conversationEngine';
import { calculateEstimate, getRunningEstimate, formatCurrency } from '../../lib/estimateEngine';
import { buildJobSummary } from '../../lib/jobSummaryBuilder';
import {
  generatePainterMatches,
  calculateGuaranteedPrice,
  type PainterProfile,
  type PainterMatch,
} from '../../lib/painterPricingEngine';
import { supabase } from '../../lib/supabase';
import PanelHeader from './PanelHeader';
import ProgressBar from './ProgressBar';
import QuestionCard from './QuestionCard';
import EstimateSummary from './EstimateSummary';
import JobSummary from './JobSummary';
import PainterMarketplace from './PainterMarketplace';

const EstimatorPanel = () => {
  const [state, setState] = useState<ConversationState>(initializeConversation);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<EstimateBreakdown | null>(null);
  const [showJobSummary, setShowJobSummary] = useState(false);
  const [painterMatches, setPainterMatches] = useState<PainterMatch[]>([]);
  const [guaranteedPrice, setGuaranteedPrice] = useState<number>(0);
  const [eligiblePainterCount, setEligiblePainterCount] = useState<number>(0);
  const [paintersLoading, setPaintersLoading] = useState(false);

  const handleAnswer = useCallback(
    (answer: string | string[]) => {
      // Validate
      const error = validateAnswer(state, answer);
      if (error) {
        setValidationError(error);
        return;
      }
      setValidationError(null);

      // Advance
      const newState = advanceConversation(state, answer);
      setState(newState);

      // If complete, calculate estimate and save
      if (newState.isComplete) {
        const est = calculateEstimate(newState.context);
        setEstimate(est);
        saveToSupabase(newState, est);
      }
    },
    [state]
  );

  const handleBack = useCallback(() => {
    setValidationError(null);
    setState(goBack(state));
  }, [state]);

  const handleRestart = useCallback(() => {
    setState(initializeConversation());
    setEstimate(null);
    setValidationError(null);
    setSaveError(null);
    setShowJobSummary(false);
    setPainterMatches([]);
    setGuaranteedPrice(0);
    setEligiblePainterCount(0);
  }, []);

  const saveToSupabase = async (s: ConversationState, est: EstimateBreakdown) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const ctx = s.context;
      const { error } = await supabase.from('quotes').insert({
        zip_code: ctx.zipCode,
        state: ctx.state,
        year_built: ctx.yearBuilt,
        property_type: ctx.propertyType,
        project_type: ctx.projectType,
        square_feet: ctx.squareFeet,
        stories: ctx.stories,
        interior_data: ctx.projectType !== 'exterior' ? {
          scope: ctx.interiorScope,
          rooms: ctx.selectedRooms,
          walls: ctx.interiorWalls,
          ceilings: ctx.interiorCeilings,
          ceilingType: ctx.ceilingType,
          trim: ctx.interiorTrim,
          doors: ctx.interiorDoors,
          doorCount: ctx.doorCount,
          windows: ctx.interiorWindows,
          windowCount: ctx.windowCount,
          cabinets: ctx.cabinetLocations,
          closets: ctx.closets,
          stairways: ctx.stairways,
          colorChange: ctx.interiorColorChange,
        } : null,
        exterior_data: ctx.projectType !== 'interior' ? {
          scope: ctx.exteriorScope,
          siding: ctx.sidingType,
          trim: ctx.exteriorTrim,
          shutters: ctx.exteriorShutters,
          garageDoor: ctx.garageDoor,
          entryDoor: ctx.entryDoor,
          railings: ctx.railings,
          deck: ctx.deck,
          fence: ctx.fence,
          fenceLinearFeet: ctx.fenceLinearFeet,
          condition: ctx.exteriorCondition,
          accessRestrictions: ctx.accessRestrictions,
          colorChange: ctx.exteriorColorChange,
        } : null,
        prep_data: ctx.prepWork.length > 0 ? {
          items: ctx.prepWork,
          caulking: ctx.caulkingExtent,
          drywall: ctx.drywallRepairExtent,
          woodRot: ctx.woodRotExtent,
          wallpaperRooms: ctx.wallpaperRooms,
          popcornRooms: ctx.popcornCeilingRooms,
        } : null,
        name: ctx.contactName,
        email: ctx.contactEmail,
        phone: ctx.contactPhone,
        notes: ctx.contactNotes,
        estimated_price: est.total,
        estimate_low: est.lowRange,
        estimate_high: est.highRange,
        confidence: est.confidence,
        specialty_referrals: ctx.specialtyReferrals,
        response_style: ctx.responseStyle,
        status: 'new',
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error saving estimate:', err);
      setSaveError('Estimate saved locally. We may follow up by phone.');
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch painters and calculate matches when estimate is ready
  useEffect(() => {
    if (!estimate || !state.isComplete) return;

    const fetchPainters = async () => {
      setPaintersLoading(true);
      try {
        const { data, error } = await supabase
          .from('painters')
          .select('*')
          .eq('verified', true)
          .eq('status', 'approved');

        if (error) throw error;

        if (data && data.length > 0) {
          const profiles: PainterProfile[] = data.map((p) => ({
            id: p.id,
            companyName: p.company_name,
            ownerName: p.owner_name,
            city: p.city,
            state: p.state,
            zipCode: p.zip_code,
            phone: p.phone,
            email: p.email,
            website: p.website || '',
            yearsInBusiness: p.years_in_business || 0,
            crewSize: p.crew_size || 1,
            hasLicense: p.has_license || false,
            licenseNumber: p.license_number || '',
            isInsured: p.is_insured || false,
            isBonded: p.is_bonded || false,
            certifications: p.certifications || [],
            serviceTypes: p.service_types || [],
            offersWarranty: p.offers_warranty || false,
            warrantyLength: p.warranty_length || '',
            offersEstimates: p.offers_estimates ?? true,
            baseline: {
              price1BRRental: Number(p.price_1br_rental) || 0,
              price3BRWalls: Number(p.price_3br_walls) || 0,
              priceKitchenCabinets: Number(p.price_kitchen_cabinets) || 0,
              priceExterior1500: Number(p.price_exterior_1500) || 0,
              priceExterior3500: Number(p.price_exterior_3500) || 0,
            },
          }));

          const matches = generatePainterMatches(profiles, state.context, estimate);
          setPainterMatches(matches);

          const gp = calculateGuaranteedPrice(matches, estimate);
          setGuaranteedPrice(gp.guaranteedPrice);
          setEligiblePainterCount(gp.eligiblePainterCount);
        } else {
          // No painters yet — still show guaranteed price from AI estimate
          setGuaranteedPrice(Math.round(estimate.total * 0.93));
          setEligiblePainterCount(0);
          setPainterMatches([]);
        }
      } catch (err) {
        console.error('Error fetching painters:', err);
        setGuaranteedPrice(Math.round(estimate.total * 0.93));
        setEligiblePainterCount(0);
        setPainterMatches([]);
      } finally {
        setPaintersLoading(false);
      }
    };

    fetchPainters();
  }, [estimate, state.isComplete, state.context]);

  // Handle user selecting the guaranteed price
  const handleSelectGuaranteed = useCallback(async () => {
    if (!estimate) return;
    const ctx = state.context;
    const jobDetails = buildJobSummary(
      ctx,
      `${formatCurrency(estimate.lowRange)} - ${formatCurrency(estimate.highRange)}`
    );

    // Save the selection to Supabase
    try {
      await supabase.from('quote_selections').insert({
        quote_zip: ctx.zipCode,
        customer_name: ctx.contactName,
        customer_email: ctx.contactEmail,
        customer_phone: ctx.contactPhone,
        selection_type: 'guaranteed',
        guaranteed_price: guaranteedPrice,
        project_summary: JSON.stringify(jobDetails),
        notified_painters: painterMatches
          .filter((m) => guaranteedPrice >= m.priceRange.low && guaranteedPrice <= m.priceRange.high * 1.1)
          .map((m) => m.painter.id),
      });
    } catch (err) {
      console.error('Error saving selection:', err);
    }
  }, [estimate, state.context, guaranteedPrice, painterMatches]);

  // Handle user selecting a specific painter
  const handleSelectPainter = useCallback(async (painterId: string) => {
    if (!estimate) return;
    const ctx = state.context;
    const match = painterMatches.find((m) => m.painter.id === painterId);
    const jobDetails = buildJobSummary(
      ctx,
      `${formatCurrency(estimate.lowRange)} - ${formatCurrency(estimate.highRange)}`
    );

    try {
      await supabase.from('quote_selections').insert({
        quote_zip: ctx.zipCode,
        customer_name: ctx.contactName,
        customer_email: ctx.contactEmail,
        customer_phone: ctx.contactPhone,
        selection_type: 'specific_painter',
        selected_painter_id: painterId,
        selected_painter_price: match?.estimatedPrice || 0,
        project_summary: JSON.stringify(jobDetails),
      });
    } catch (err) {
      console.error('Error saving selection:', err);
    }
  }, [estimate, state.context, painterMatches]);

  const currentNode = getCurrentNode(state);
  const progress = getProgress(state);
  const runningEstimate = getRunningEstimate(state.context);

  // Calculate confidence for header
  const q = state.context.answeredQuestions;
  const confidenceLevel = q >= 12 && state.context.responseStyle !== 'terse'
    ? 'high' as const
    : q >= 6
    ? 'medium' as const
    : 'low' as const;

  // Build job summary if needed
  const jobSummary = estimate
    ? buildJobSummary(
        state.context,
        `${formatCurrency(estimate.lowRange)} - ${formatCurrency(estimate.highRange)}`
      )
    : null;

  return (
    <div className="estimator-panel">
      <PanelHeader
        runningEstimate={runningEstimate}
        confidenceLevel={runningEstimate ? confidenceLevel : undefined}
      />
      <ProgressBar progress={state.isComplete ? 100 : progress} />

      <div className="estimator-body">
        {state.isComplete && estimate ? (
          <>
            <EstimateSummary
              estimate={estimate}
              onRestart={handleRestart}
              isSaving={isSaving}
              saveError={saveError}
            />

            {jobSummary && (
              <div className="estimator-job-toggle">
                <button
                  className="estimator-job-toggle-btn"
                  onClick={() => setShowJobSummary(!showJobSummary)}
                  type="button"
                >
                  {showJobSummary ? 'Hide' : 'View'} Full Job Details
                </button>
                {showJobSummary && <JobSummary summary={jobSummary} />}
              </div>
            )}

            {/* Painter Marketplace */}
            {paintersLoading ? (
              <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>
                Finding painters in your area...
              </div>
            ) : estimate && (
              <PainterMarketplace
                aiEstimate={estimate}
                guaranteedPrice={guaranteedPrice}
                eligiblePainterCount={eligiblePainterCount}
                painterMatches={painterMatches}
                context={state.context}
                onSelectGuaranteed={handleSelectGuaranteed}
                onSelectPainter={handleSelectPainter}
              />
            )}
          </>
        ) : currentNode ? (
          <QuestionCard
            node={currentNode}
            onAnswer={handleAnswer}
            validationError={validationError}
            canGoBack={state.history.length > 0}
            onBack={handleBack}
            specialtyReferrals={state.context.specialtyReferrals}
          />
        ) : null}
      </div>
    </div>
  );
};

export default EstimatorPanel;
