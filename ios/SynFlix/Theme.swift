import SwiftUI
import UIKit

enum SynFlixTheme: String, CaseIterable, Identifiable, Codable {
    case synflix
    case aqua
    case autumn
    case cherri
    case evergreen
    case rose
    case violet
    case purple
    case red
    case monochrome
    case noir
    case teal

    var id: String { rawValue }

    var name: String {
        switch self {
        case .synflix: return "SynFlix"
        case .aqua: return "Aqua"
        case .autumn: return "Autumn"
        case .cherri: return "Cherri"
        case .evergreen: return "Evergreen"
        case .rose: return "Rose"
        case .violet: return "Violet"
        case .purple: return "Purple"
        case .red: return "Red"
        case .monochrome: return "Mono"
        case .noir: return "Noir"
        case .teal: return "Teal"
        }
    }

    var accentHex: String {
        switch self {
        case .synflix: return "#FFD400"
        case .aqua: return "#54E7F1"
        case .autumn: return "#FF9D42"
        case .cherri: return "#FF5D8F"
        case .evergreen: return "#64D98B"
        case .rose: return "#FF91AD"
        case .violet: return "#A78BFA"
        case .purple: return "#8B5CF6"
        case .red: return "#FF4D55"
        case .monochrome: return "#F4F4F4"
        case .noir: return "#C8C8C8"
        case .teal: return "#35D0BA"
        }
    }

    var accent: Color { Color(hex: accentHex) }

    var glow: Color {
        switch self {
        case .synflix: return Color(hex: "#B88E00")
        case .noir, .monochrome: return .white
        default: return accent
        }
    }
}

extension Color {
    init(hex: String) {
        let clean = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: clean).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xff) / 255
        let g = Double((value >> 8) & 0xff) / 255
        let b = Double(value & 0xff) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: 1)
    }
}

@MainActor
final class ThemeStore: ObservableObject {
    @Published var theme: SynFlixTheme {
        didSet {
            UserDefaults.standard.set(theme.rawValue, forKey: "synflix.native.theme")
            if hapticsEnabled {
                UISelectionFeedbackGenerator().selectionChanged()
            }
        }
    }

    @Published var hapticsEnabled: Bool {
        didSet { UserDefaults.standard.set(hapticsEnabled, forKey: "synflix.native.haptics") }
    }

    @Published var autoplayEnabled: Bool {
        didSet { UserDefaults.standard.set(autoplayEnabled, forKey: "synflix.native.autoplay") }
    }

    @Published var reducedMotion: Bool {
        didSet { UserDefaults.standard.set(reducedMotion, forKey: "synflix.native.reduceMotion") }
    }

    init() {
        let raw = UserDefaults.standard.string(forKey: "synflix.native.theme") ?? SynFlixTheme.synflix.rawValue
        theme = SynFlixTheme(rawValue: raw) ?? .synflix
        hapticsEnabled = UserDefaults.standard.object(forKey: "synflix.native.haptics") as? Bool ?? true
        autoplayEnabled = UserDefaults.standard.object(forKey: "synflix.native.autoplay") as? Bool ?? true
        reducedMotion = UserDefaults.standard.object(forKey: "synflix.native.reduceMotion") as? Bool ?? false
    }

    var accent: Color { theme.accent }

    func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .soft) {
        guard hapticsEnabled else { return }
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }
}

extension View {
    @ViewBuilder
    func synflixGlass(
        tint: Color? = nil,
        cornerRadius: CGFloat = 24,
        interactive: Bool = false
    ) -> some View {
        if #available(iOS 26.0, *) {
            if let tint {
                if interactive {
                    self.glassEffect(
                        .regular.tint(tint).interactive(),
                        in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    )
                } else {
                    self.glassEffect(
                        .regular.tint(tint),
                        in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    )
                }
            } else if interactive {
                self.glassEffect(
                    .regular.interactive(),
                    in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                )
            } else {
                self.glassEffect(
                    .regular,
                    in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                )
            }
        } else {
            self
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .stroke(.white.opacity(0.10), lineWidth: 0.7)
                }
        }
    }

    @ViewBuilder
    func synflixCircleGlass(tint: Color? = nil, interactive: Bool = true) -> some View {
        if #available(iOS 26.0, *) {
            if let tint {
                self.glassEffect(
                    interactive ? .regular.tint(tint).interactive() : .regular.tint(tint),
                    in: Circle()
                )
            } else {
                self.glassEffect(
                    interactive ? .regular.interactive() : .regular,
                    in: Circle()
                )
            }
        } else {
            self
                .background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().stroke(.white.opacity(0.10), lineWidth: 0.7))
        }
    }
}

struct SynFlixBrandMark: View {
    let size: CGFloat

    var body: some View {
        Group {
            if let image = UIImage(named: "SynFlixLogo") {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: size * 0.18, style: .continuous)
                        .fill(Color(hex: "#FFD400"))
                    Text("S")
                        .font(.system(size: size * 0.50, weight: .black, design: .rounded))
                        .foregroundStyle(.black)
                }
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}
