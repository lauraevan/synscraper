from pathlib import Path
import sys

root=Path(sys.argv[1])
f=root/'Civy/RootView.swift'
s=f.read_text()
assert s.count('    var player: AVPlayer? = nil') == 2
s=s.replace('    var player: AVPlayer? = nil\n\n    func makeUIView', '    func makeUIView', 1)
s=s.replace('        view.isRoutePickerButtonBordered = false\n','')
s=s.replace('        view.player = player\n','')
s=s.replace('    func updateUIView(_ uiView: AVRoutePickerView, context: Context) {\n        uiView.player = player\n    }', '    func updateUIView(_ uiView: AVRoutePickerView, context: Context) { }')
s=s.replace('        CivyAirPlayPicker(player: player)', '        CivyAirPlayPicker()')
s=s.replace('    var player: AVPlayer? = nil\n    @AppStorage("civy.appearance.glass") private var glass = true',
            '    @AppStorage("civy.appearance.glass") private var glass = true')
s=s.replace('    @AppStorage("civy.profile.name") private var profileName = "My Profile"',
            '    @AppStorage("civy.profile.name") private var profileName = "My Profile"\n    @AppStorage("civy.appearance.glass") private var glass = true',1)
assert s.count('    var body: some View {\n        ZStack {\n            LinearGradient(stops: [')==1
s=s.replace('    var body: some View {\n        ZStack {\n            LinearGradient(stops: [',
            '    var body: some View {\n        let animateScroll = motion && !reduceMotion && !systemReduceMotion\n        return ZStack {\n            LinearGradient(stops: [',1)
s=s.replace('motion && !reduceMotion && !systemReduceMotion && !phase.isIdentity',
            'animateScroll && !phase.isIdentity')
s=s.replace('// Assigning the active AVPlayer makes the route picker control the video actually playing.',
            '// iOS routes playback through the system session; AVPlayer.allowsExternalPlayback is enabled.')
f.write_text(s)

f=root/'Civy/Design.swift'
s=f.read_text()
assert s.count('    var body: some View {\n        Button { onTap(media) } label: {')==1
s=s.replace('    var body: some View {\n        Button { onTap(media) } label: {',
            '    var body: some View {\n        let animateScroll = motion && !reduceMotion && !systemReduceMotion\n        return Button { onTap(media) } label: {',1)
s=s.replace('motion && !reduceMotion && !systemReduceMotion && !phase.isIdentity',
            'animateScroll && !phase.isIdentity')
f.write_text(s)

f=root/'Civy/PlayerScreen.swift'
s=f.read_text().replace('CivyAirPlayControl(player: playback.player)', 'CivyAirPlayControl()')
f.write_text(s)
print("iOS-native route picker and animation isolation fixed")
