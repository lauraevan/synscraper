"""Apply Civy Beta branding to every unsigned build.
Run after the version-specific SwiftUI patch and before xcodebuild.
The iOS marketing version stays numeric for signing compatibility.
"""
from pathlib import Path
import sys

root = Path(sys.argv[1])
project = root / "Civy.xcodeproj" / "project.pbxproj"
home = root / "Civy" / "RootView.swift"
settings = root / "Civy" / "SettingsView.swift"

p = project.read_text()
assert p.count("INFOPLIST_KEY_CFBundleDisplayName = Civy;") == 2
p = p.replace("INFOPLIST_KEY_CFBundleDisplayName = Civy;", 'INFOPLIST_KEY_CFBundleDisplayName = "Civy Beta";')
# Keep the same bundle ID and numeric marketing version; bump the internal build.
import re
p = re.sub(r'CURRENT_PROJECT_VERSION = "[0-9]+";', 'CURRENT_PROJECT_VERSION = "5";', p)
assert p.count('INFOPLIST_KEY_CFBundleDisplayName = "Civy Beta";') == 2
project.write_text(p)

s = home.read_text()
needle = '''            Spacer(minLength: 4)
            CivyAirPlayControl()'''
badge = '''            Text("BETA")
                .font(.system(size: 12, weight: .bold, design: .default))
                .tracking(0.25)
                .foregroundStyle(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(Capsule().fill(Color.synAccent.opacity(0.85)))
                .accessibilityLabel("Civy Beta")
            Spacer(minLength: 4)
            CivyAirPlayControl()'''
assert s.count(needle) == 1, "Home top bar changed; Beta badge needs review"
s = s.replace(needle, badge, 1)
# Display the channel on both the home footer and Home Screen.
s = s.replace('Text("civy")\n                            .font(.system(size: 21, weight: .black, design: .default))',
              'Text("civy · beta")\n                            .font(.system(size: 21, weight: .black, design: .default))', 1)
home.write_text(s)

a = settings.read_text()
assert 'Text("Version 3.2 · Cinema Edition")' in a
a = a.replace('Text("Version 3.2 · Cinema Edition")',
              'Text("Version \\(Bundle.main.object(forInfoDictionaryKey: \\"CFBundleShortVersionString\\") as? String ?? \\"3.6.0\\") · Beta")', 1)
# Label About as Beta while keeping non-release app identity Civy.
a = a.replace('Text("civy").font(.system(size: 37, weight: .bold, design: .default)).tracking(-1.8)',
              'Text("civy beta").font(.system(size: 37, weight: .bold, design: .default)).tracking(-1.8)', 1)
settings.write_text(a)
print("Civy Beta branding applied to display name, Home, About, and build number.")
