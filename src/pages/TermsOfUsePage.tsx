import { FileText } from 'lucide-react';
import InfoPageLayout from './InfoPageLayout';

export default function TermsOfUsePage() {
  return (
    <InfoPageLayout
      icon={FileText}
      titleKey="terms.title"
      subtitleKey="terms.subtitle"
      heroNoteKey="terms.heroNote"
      sections={[
        { titleKey: 'terms.section1.title', bodyKeys: ['terms.section1.body1', 'terms.section1.body2'] },
        { titleKey: 'terms.section2.title', bodyKeys: ['terms.section2.body1', 'terms.section2.body2'] },
        { titleKey: 'terms.section3.title', bodyKeys: ['terms.section3.body1', 'terms.section3.body2'] },
        { titleKey: 'terms.section4.title', bodyKeys: ['terms.section4.body1'] },
      ]}
    />
  );
}
