import { HelpCircle } from 'lucide-react';
import InfoPageLayout from './InfoPageLayout';

export default function FAQPage() {
  return (
    <InfoPageLayout
      icon={HelpCircle}
      titleKey="faq.title"
      subtitleKey="faq.subtitle"
      sections={[
        { titleKey: 'faq.q1', bodyKeys: ['faq.a1'] },
        { titleKey: 'faq.q2', bodyKeys: ['faq.a2'] },
        { titleKey: 'faq.q3', bodyKeys: ['faq.a3'] },
        { titleKey: 'faq.q4', bodyKeys: ['faq.a4'] },
        { titleKey: 'faq.q5', bodyKeys: ['faq.a5'] },
        { titleKey: 'faq.q6', bodyKeys: ['faq.a6'] },
      ]}
    />
  );
}
