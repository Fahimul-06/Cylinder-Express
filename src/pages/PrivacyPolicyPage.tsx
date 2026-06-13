import { ShieldCheck } from 'lucide-react';
import InfoPageLayout from './InfoPageLayout';

export default function PrivacyPolicyPage() {
  return (
    <InfoPageLayout
      icon={ShieldCheck}
      titleKey="privacy.title"
      subtitleKey="privacy.subtitle"
      heroNoteKey="privacy.heroNote"
      sections={[
        { titleKey: 'privacy.section1.title', bodyKeys: ['privacy.section1.body1', 'privacy.section1.body2'] },
        { titleKey: 'privacy.section2.title', bodyKeys: ['privacy.section2.body1', 'privacy.section2.body2'] },
        { titleKey: 'privacy.section3.title', bodyKeys: ['privacy.section3.body1', 'privacy.section3.body2'] },
        { titleKey: 'privacy.section4.title', bodyKeys: ['privacy.section4.body1'] },
      ]}
    />
  );
}
