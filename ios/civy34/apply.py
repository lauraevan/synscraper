from pathlib import Path
import re
import sys

root = Path(sys.argv[1])
main = root / "Civy" / "RootView.swift"
s = main.read_text()
s = s.replace('case .clips: "play.rectangle.on.rectangle"', 'case .clips: "play.rectangle"')
s = s.replace('case .clips: "play.rectangle.on.rectangle.fill"', 'case .clips: "play.rectangle.fill"')
s = s.replace('case .mine: "person.crop.square"', 'case .mine: "person.crop.circle"')
s = s.replace('case .mine: "person.crop.square.fill"', 'case .mine: "person.crop.circle.fill"')

start = s.index("private struct CivyFloatingDock: View {")
end = s.index("private struct CivyAirPlayPicker:", start)
dock = """private struct CivyFloatingDock: View {
    @Binding var selected: CivyTab
    let glass: Bool
    let animate: Bool
    @AppStorage("civy.appearance.haptics") private var haptics = true
    @Namespace private var selectionGlass

    var body: some View {
        GlassEffectContainer(spacing: 8) {
            HStack(spacing: 3) {
                ForEach(CivyTab.allCases) { tab in
                    Button {
                        if haptics { UISelectionFeedbackGenerator().selectionChanged() }
                        if animate {
                            withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) {
                                selected = tab
                            }
                        } else {
                            selected = tab
                        }
                    } label: {
                        VStack(spacing: 5) {
                            Image(systemName: selected == tab ? tab.selectedSymbol : tab.symbol)
                                .font(.system(size: 22, weight: selected == tab ? .semibold : .regular))
                                .symbolRenderingMode(.hierarchical)
                                .contentTransition(.symbolEffect(.replace))
                                .frame(height: 27)
                            Text(tab.rawValue)
                                .font(.system(size: 12, weight: selected == tab ? .semibold : .medium, design: .default))
                                .lineLimit(1)
                                .minimumScaleFactor(0.9)
                        }
                        .foregroundStyle(selected == tab ? Color.white : Color.white.opacity(0.78))
                        .frame(maxWidth: .infinity)
                        .frame(height: 65)
                        .contentShape(Capsule())
                        .background {
                            if selected == tab {
                                Capsule()
                                    .fill(Color.white.opacity(glass ? 0.035 : 0.13))
                                    .glassEffect(glass ? .regular.tint(Color.synAccent.opacity(0.30)).interactive() : .identity, in: Capsule())
                                    .glassEffectID("selected-civy-tab", in: selectionGlass)
                                    .padding(.vertical, 1)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(tab.rawValue)
                    .accessibilityAddTraits(selected == tab ? .isSelected : [])
                }
            }
            .padding(6)
            .glassEffect(glass ? .regular.tint(Color.black.opacity(0.24)).interactive() : .identity, in: Capsule())
            .background {
                if !glass {
                    Capsule().fill(.ultraThinMaterial)
                }
            }
            .overlay {
                Capsule().strokeBorder(Color.white.opacity(glass ? 0.23 : 0.12), lineWidth: 0.7)
                    .allowsHitTesting(false)
            }
            .shadow(color: Color.black.opacity(0.48), radius: 22, y: 11)
        }
        .accessibilityElement(children: .contain)
    }
}

"""
s = s[:start] + dock + s[end:]
s = s.replace("design: .rounded", "design: .default")
s = s.replace("        .fullScreenCover(item: $app.playbackRequest)", "        .fontDesign(.default)\n        .fullScreenCover(item: $app.playbackRequest)", 1)
main.write_text(s)

settings = root / "Civy" / "SettingsView.swift"
settings.write_text(settings.read_text().replace("design: .rounded", "design: .default"))

project = root / "Civy.xcodeproj" / "project.pbxproj"
p = project.read_text()
p, count = p.replace('MARKETING_VERSION = "3.2.0";', 'MARKETING_VERSION = "3.4.0";'), p.count('MARKETING_VERSION = "3.2.0";')
if count != 2:
    raise RuntimeError(f"Expected two Xcode version settings; found {count}")
project.write_text(p)
print("Civy 3.4 native Liquid Glass dock and SF Pro/SF Symbols ready")
