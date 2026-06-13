import { Info } from 'lucide-react';
import InfoPageLayout from './InfoPageLayout';

export default function AboutPage() {
  return (
    <InfoPageLayout
      icon={Info}
      titleKey="about.title"
      subtitleKey="about.subtitle"
      heroNoteKey="about.heroNote"
      sections={[
        { titleKey: 'about.section1.title', bodyKeys: ['about.section1.body1', 'about.section1.body2'] },
        { titleKey: 'about.section2.title', bodyKeys: ['about.section2.body1', 'about.section2.body2'] },
        { titleKey: 'about.section3.title', bodyKeys: ['about.section3.body1', 'about.section3.body2'] },
      ]}
    />
  );
}
