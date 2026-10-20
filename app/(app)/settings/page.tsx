import { ThemePicker } from "@/components/theme-picker";
import { Panel, PanelBody, PanelHeader } from "@/components/ui";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto py-6 flex flex-col gap-6">
      <Panel>
        <PanelHeader
          title="Appearance"
          description="Customize the color scheme and appearance for this device."
        />
        <PanelBody>
          <ThemePicker />
        </PanelBody>
      </Panel>
    </div>
  );
}
