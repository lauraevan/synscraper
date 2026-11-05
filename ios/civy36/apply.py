from pathlib import Path
import sys
root=Path(sys.argv[1])
f=root/'Civy/RootView.swift'
s=f.read_text()
assert 'private struct CivyAirPlayPicker: UIViewRepresentable {' in s
assert 'CivyAirPlayPicker().frame(width: 39, height: 39)' in s
s=s.replace('            .id(tab)\n            .transition(.opacity)','            .transition(.opacity)',1)
start=s.index('private struct CivyAirPlayPicker: UIViewRepresentable {')
end=s.index('private enum BrowseFilter: String {', start)
new='''// The cast-style icon matches the reference screenshot; the true AVRoutePickerView handles taps.
private struct CivyCastGlyph: View {
    var body: some View {
        Canvas { context, size in
            let sx = size.width / 30.0
            let sy = size.height / 30.0
            func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: x*sx, y: y*sy) }
            var screen = Path()
            screen.move(to: pt(3, 12))
            screen.addLine(to: pt(3, 5.5))
            screen.addQuadCurve(to: pt(5.5, 3), control: pt(3, 3))
            screen.addLine(to: pt(26, 3))
            screen.addQuadCurve(to: pt(28, 5), control: pt(28, 3))
            screen.addLine(to: pt(28, 25))
            screen.addQuadCurve(to: pt(26, 27), control: pt(28, 27))
            screen.addLine(to: pt(14, 27))
            var waves = Path()
            waves.move(to: pt(3, 15))
            waves.addCurve(to: pt(13, 25), control1: pt(8.5, 15), control2: pt(13, 20))
            waves.move(to: pt(3, 21))
            waves.addCurve(to: pt(7.2, 25.2), control1: pt(5.5, 21), control2: pt(7.2, 23))
            let stroke = StrokeStyle(lineWidth: 2.5*sx, lineCap: .round, lineJoin: .round)
            context.stroke(screen, with: .color(.white), style: stroke)
            context.stroke(waves, with: .color(.white), style: stroke)
            context.fill(Path(ellipseIn: CGRect(x: 2*sx, y: 25.5*sy, width: 3*sx, height: 3*sy)), with: .color(.white))
            context.fill(Path(ellipseIn: CGRect(x: 24*sx, y: 0, width: 8*sx, height: 8*sy)), with: .color(Color.synAccent))
        }
        .frame(width: 30, height: 30)
        .accessibilityHidden(true)
    }
}
private struct CivyAirPlayPicker: UIViewRepresentable {
    func makeUIView(context: Context) -> AVRoutePickerView {
        let picker = AVRoutePickerView(frame: CGRect(x: 0, y: 0, width: 44, height: 44))
        picker.backgroundColor = .clear
        picker.tintColor = .clear
        picker.activeTintColor = .clear
        picker.prioritizesVideoDevices = true
        picker.accessibilityLabel = "AirPlay and casting"
        return picker
    }
    func updateUIView(_ uiView: AVRoutePickerView, context: Context) { }
}
private struct CivyAirPlayControl: View {
    var body: some View {
        ZStack {
            CivyCastGlyph().allowsHitTesting(false)
            CivyAirPlayPicker().frame(width: 44, height: 44)
        }
        .frame(width: 44, height: 44)
        .accessibilityLabel("AirPlay and casting")
        .accessibilityHint("Choose an Apple TV or compatible receiver")
    }
}

'''
s=s[:start]+new+s[end:]
s=s.replace('CivyAirPlayPicker().frame(width: 39, height: 39)\n                .accessibilityLabel("AirPlay and casting")','CivyAirPlayControl()',1)
s=s.replace('TMDBImage.url(media.posterPath, size: largeArt ? "original" : "w780")','TMDBImage.url(media.posterPath, size: largeArt ? "w780" : "w500")')
s=s.replace('    @AppStorage("civy.home.heroInterval") private var heroInterval = 10','    @AppStorage("civy.home.heroInterval") private var heroInterval = 14')
s=s.replace('withAnimation(.easeInOut(duration: 0.52)) { heroIndex = (heroIndex + 1) % heroes.count }','withAnimation(.easeInOut(duration: 0.4)) { heroIndex = (heroIndex + 1) % heroes.count }')
f.write_text(s)
player=root/'Civy/PlayerScreen.swift'
p=player.read_text()
p=p.replace('CivyAirPlayPicker()', 'CivyAirPlayControl()')
p=p.replace('CMTime(seconds: 0.35, preferredTimescale: 600)', 'CMTime(seconds: 0.75, preferredTimescale: 600)')
player.write_text(p)
api=root/'Civy/SynAPI.swift'
a=api.read_text().replace('cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 35','cachePolicy: .useProtocolCachePolicy, timeoutInterval: 30')
api.write_text(a)
project=root/'Civy.xcodeproj/project.pbxproj'
x=project.read_text()
assert x.count('MARKETING_VERSION = "3.4.0";')==2
project.write_text(x.replace('MARKETING_VERSION = "3.4.0";','MARKETING_VERSION = "3.6.0";'))
print('Civy 3.6 stability fixes applied.')
