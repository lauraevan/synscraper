"""Civy 3.9.7: replace the bottom navigation with Apple Music's iOS 26 layout."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
file = root / "Civy/RootView.swift"
settings = root / "Civy/SettingsView.swift"
project = root / "Civy.xcodeproj/project.pbxproj"

src = file.read_text()
start = src.index("private struct CivyFloatingDock: View {")
end = src.index("\n}\n\n", start) + len("\n}\n\n")
dock = '''// iOS 26 Apple Music pattern: one fluid glass tab capsule and an
// independent circular Search button, not a single five-column pill.
private struct CivyFloatingDock: View {
    @Binding var selected: CivyTab
    let glass: Bool
    let animate: Bool

    @EnvironmentObject private var viewers: CivyViewerStore
    @AppStorage("civy.appearance.haptics") private var haptics = true
    @Namespace private var selectionGlass

    private let mainTabs: [CivyTab] = [.home, .live, .clips, .mine]

    private func choose(_ tab: CivyTab) {
        if haptics { UISelectionFeedbackGenerator().selectionChanged() }
        if animate {
            withAnimation(.spring(response: 0.36, dampingFraction: 0.83)) {
                selected = tab
            }
        } else {
            selected = tab
        }
    }

    var body: some View {
        GlassEffectContainer(spacing: 11) {
            HStack(alignment: .center, spacing: 11) {
                HStack(spacing: 0) {
                    ForEach(mainTabs) { tab in
                        Button { choose(tab) } label: {
                            VStack(spacing: 3) {
                                if tab == .mine {
                                    CivyViewerAvatar(
                                        viewer: viewers.active ?? CivyViewer(
                                            id: "primary", name: "You",
                                            symbol: "person.fill", tintIndex: 0),
                                        size: 27
                                    )
                                    .frame(height: 27)
                                } else {
                                    Image(systemName: selected == tab ? tab.selectedSymbol : tab.symbol)
                                        .font(.system(size: 20, weight: selected == tab ? .semibold : .regular))
                                        .symbolRenderingMode(.hierarchical)
                                        .contentTransition(.symbolEffect(.replace))
                                        .frame(height: 27)
                                }
                                Text(tab.rawValue)
                                    .font(.system(size: 10, weight: selected == tab ? .semibold : .medium))
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.75)
                            }
                            .foregroundStyle(selected == tab ? .white : .white.opacity(0.72))
                            .frame(maxWidth: .infinity)
                            .frame(height: 49)
                            .contentShape(Capsule())
                            .background {
                                if selected == tab {
                                    Capsule()
                                        .fill(.white.opacity(glass ? 0.075 : 0.14))
                                        .glassEffect(
                                            glass ? .regular.tint(Color.synAccent.opacity(0.15)).interactive() : .identity,
                                            in: Capsule()
                                        )
                                        .glassEffectID("active-civy-tab", in: selectionGlass)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(tab.rawValue)
                        .accessibilityAddTraits(selected == tab ? .isSelected : [])
                    }
                }
                .padding(5)
                .frame(height: 59)
                .glassEffect(glass ? .regular.interactive() : .identity, in: Capsule())
                .background {
                    if !glass { Capsule().fill(.ultraThinMaterial) }
                }
                .overlay {
                    Capsule().strokeBorder(.white.opacity(glass ? 0.22 : 0.10), lineWidth: 0.8)
                        .allowsHitTesting(false)
                }
                .shadow(color: .black.opacity(0.25), radius: 15, y: 9)

                Button { choose(.search) } label: {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 23, weight: selected == .search ? .semibold : .medium))
                        .foregroundStyle(.white)
                        .frame(width: 59, height: 59)
                        .contentShape(Circle())
                        .glassEffect(
                            glass ? .regular.tint(selected == .search ?
                                 Color.synAccent.opacity(0.25) : Color.clear).interactive() : .identity,
                            in: Circle()
                        )
                        .overlay {
                            Circle().strokeBorder(.white.opacity(glass ? 0.24 : 0.10), lineWidth: 0.8)
                                .allowsHitTesting(false)
                        }
                        .background {
                            if !glass { Circle().fill(.ultraThinMaterial) }
                        }
                        .shadow(color: .black.opacity(0.24), radius: 13, y: 8)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Search")
                .accessibilityAddTraits(selected == .search ? .isSelected : [])
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("civy.appleMusicStyleTabBar")
    }
}

'''
src = src[:start] + dock + src[end:]
assert src.count("civy.appleMusicStyleTabBar") == 1
assert src.count("ForEach(mainTabs)") == 1
assert src.count('Button { choose(.search) }') == 1
file.write_text(src)

setting = settings.read_text()
start = setting.index("struct SettingsView: View {")
end = setting.index("private struct ProfileSettings: View {", start)
block = setting[start:end]
# Keep the native grouped settings users asked for. Remove unnecessary nesting
# from the top level and add visible version confirmation for sideload testing.
assert 'Form {' in block and 'Section("Playback")' in block
assert 'Section("Video")' in block and 'Section("App")' in block
assert '.navigationBarTitleDisplayMode(.inline)' in block
assert 'Button("Done")' in block

block = block.replace('''                    NavigationLink(value: CivySettingsPage.player) {
                        Text("More Playback Options")
                    }
''', '''                    NavigationLink(value: CivySettingsPage.player) {
                        Text("Advanced Playback")
                    }
''', 1)
block = block.replace('''                    NavigationLink(value: CivySettingsPage.about) {
                        Text("About Civy Beta")
                    }
''', '''                    NavigationLink(value: CivySettingsPage.about) {
                        Text("About Civy Beta")
                    }
                }
                Section {
                    HStack {
                        Spacer()
                        Text("Civy Beta · Version 3.9.7")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
''', 1)
# Make row grouping visually consistent across iPhone sizes.
block = block.replace('''.listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)''', '''.listStyle(.insetGrouped)
            .environment(\\.defaultMinListRowHeight, 54)
            .scrollContentBackground(.hidden)''', 1)
setting = setting[:start] + block + setting[end:]
settings.write_text(setting)

x = project.read_text()
assert x.count('MARKETING_VERSION = "3.9.6";') == 2
assert x.count('CURRENT_PROJECT_VERSION = "13";') == 2
x = x.replace('MARKETING_VERSION = "3.9.6";', 'MARKETING_VERSION = "3.9.7";')
x = x.replace('CURRENT_PROJECT_VERSION = "13";', 'CURRENT_PROJECT_VERSION = "14";')
project.write_text(x)

print("Civy 3.9.7: Apple Music iOS 26 tab capsule + separate Search bubble; native grouped Settings")
