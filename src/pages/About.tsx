import { CheckCircle, Award, Users, Clock } from 'lucide-react';

const About = () => {
  return (
    <div>
      {/* Hero */}
      <section className="bg-primary text-white py-20">
        <div className="container-custom">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">About The Painted Painter</h1>
          <p className="text-xl text-gray-200 max-w-2xl">
            18+ years of experience engineering hundreds of painting projects with efficient methods and quality products.
          </p>
        </div>
      </section>

      {/* Story Section */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-primary mb-6">Our Story</h2>
              <p className="text-gray-600 mb-4">
                The Painted Painter was founded with a simple mission: to provide fast, affordable, and high-quality painting services to homeowners and businesses in San Diego.
              </p>
              <p className="text-gray-600 mb-4">
                With over 18 years of experience in the painting industry, we've developed efficient methods that allow us to deliver exceptional results in less time. We've expanded our network to include trusted painters across the country, ensuring quality service wherever you are.
              </p>
              <p className="text-gray-600">
                As a licensed contractor (#1019026), we take pride in our workmanship and stand behind every project we complete.
              </p>
            </div>
            <div className="bg-gray-100 rounded-xl p-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-secondary mb-2">18+</div>
                  <div className="text-gray-600">Years Experience</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-secondary mb-2">500+</div>
                  <div className="text-gray-600">Projects Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-secondary mb-2">100%</div>
                  <div className="text-gray-600">Satisfaction Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-secondary mb-2">50+</div>
                  <div className="text-gray-600">Painters Nationwide</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-gray-50">
        <div className="container-custom">
          <h2 className="text-3xl font-bold text-primary text-center mb-12">Our Values</h2>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { icon: <CheckCircle className="w-10 h-10" />, title: 'Quality', desc: 'We never compromise on the quality of our work or materials.' },
              { icon: <Clock className="w-10 h-10" />, title: 'Efficiency', desc: 'Our streamlined processes ensure fast turnarounds without sacrificing quality.' },
              { icon: <Award className="w-10 h-10" />, title: 'Integrity', desc: 'We provide honest quotes and transparent communication throughout.' },
              { icon: <Users className="w-10 h-10" />, title: 'Customer Focus', desc: 'Your satisfaction is our top priority on every project.' },
            ].map((value, index) => (
              <div key={index} className="text-center">
                <div className="text-secondary mb-4 flex justify-center">{value.icon}</div>
                <h3 className="text-xl font-semibold text-primary mb-2">{value.title}</h3>
                <p className="text-gray-600">{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
