from pathlib import Path
import sys
root=Path(sys.argv[1])
p=root/'Civy/RootView.swift'
s=p.read_text()
changes=[
('GlassEffectContainer(spacing: 4)', 'GlassEffectContainer(spacing: 10)'),
('Color.white.opacity(glass ? 0.20 : 0.16)', 'Color.white.opacity(glass ? 0.035 : 0.14)'),
('.regular.tint(Color.white.opacity(0.24)).interactive()', '.regular.tint(Color.white.opacity(0.075)).interactive()'),
('.regular.tint(Color.white.opacity(0.11)).interactive()', '.regular.interactive()'),
('Color.white.opacity(glass ? 0.35 : 0.12)', 'Color.white.opacity(glass ? 0.20 : 0.12)'),
('Color.black.opacity(0.55), radius: 24, y: 12', 'Color.black.opacity(0.29), radius: 18, y: 9'),
('Color.white.opacity(0.09), radius: 3, y: -1', 'Color.white.opacity(0.15), radius: 5, y: -2'),
('.background(isSelected ? Color.synAccent.opacity(0.30) : Color.black.opacity(0.76), in: Capsule())',
 '.glassEffect(.regular.tint(isSelected ? Color.synAccent.opacity(0.25) : Color.clear).interactive(), in: Capsule())'),
('Color.white.opacity(isSelected ? 0.26 : 0.10)', 'Color.white.opacity(isSelected ? 0.28 : 0.16)'),
('.background(Color.black.opacity(0.70), in: Capsule())', '.background(Color.black.opacity(0.18), in: Capsule())')
]
for before,after in changes:
    assert before in s, "Missing RootView anchor: "+before
    s=s.replace(before,after,1)
p.write_text(s)

p=root/'Civy/SearchView.swift'
s=p.read_text()
old='.background(Color(white: 0.075), in: RoundedRectangle(cornerRadius: 14, style: .continuous))'
assert old in s, "Missing SearchView material anchor"
s=s.replace(old,'.glassEffect(.regular.interactive(), in: RoundedRectangle(cornerRadius: 17, style: .continuous))',1)
p.write_text(s)

p=root/'Civy.xcodeproj/project.pbxproj'
s=p.read_text()
assert s.count('MARKETING_VERSION = "3.9.0";')==2
s=s.replace('MARKETING_VERSION = "3.9.0";','MARKETING_VERSION = "3.9.1";')
s=s.replace('CURRENT_PROJECT_VERSION = "8";','CURRENT_PROJECT_VERSION = "9";')
p.write_text(s)
print("Civy 3.9.1 Beta: clear Liquid Glass and semantic build version applied")
