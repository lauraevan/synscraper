import SwiftUI

private struct MediaPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.978 : 1)
            .opacity(configuration.isPressed ? 0.94 : 1)
            .animation(.easeOut(duration: 0.11), value: configuration.isPressed)
    }
}

struct ArtworkView: View {
    let url: URL?
    let cornerRadius: CGFloat

    init(url: URL?, cornerRadius: CGFloat = 7) {
        self.url = url
        self.cornerRadius = cornerRadius
    }

    var body: some View {
        AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.18))) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFill()
            case .failure:
                placeholder
            case .empty:
                placeholder
                    .overlay {
                        ProgressView()
                            .controlSize(.small)
                            .tint(.white.opacity(0.28))
                    }
            @unknown default:
                placeholder
            }
        }
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }

    private var placeholder: some View {
        LinearGradient(
            colors: [Color.white.opacity(0.042), Color.white.opacity(0.014)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

struct PosterCard: View {
    let item: MediaItem
    var width: CGFloat = 142
    var showMeta: Bool = false
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        Button {
            router.open(item)
        } label: {
            VStack(alignment: .leading, spacing: 7) {
                ArtworkView(url: item.posterURL, cornerRadius: 7)
                    .frame(width: width, height: width * 1.50)
                    .overlay {
                        RoundedRectangle(cornerRadius: 7, style: .continuous)
                            .stroke(.white.opacity(0.045), lineWidth: 0.55)
                    }

                if showMeta {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.displayTitle)
                            .font(.system(size: 12.25, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.92))
                            .lineLimit(1)

                        HStack(spacing: 4) {
                            if !item.year.isEmpty { Text(item.year) }
                            if !item.year.isEmpty { Text("·") }
                            Text(item.kind == "tv" ? "Series" : "Movie")
                        }
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.white.opacity(0.36))
                    }
                    .frame(width: width, alignment: .leading)
                }
            }
        }
        .buttonStyle(MediaPressStyle())
        .accessibilityLabel(item.displayTitle)
    }
}

struct LandscapeCard: View {
    let item: MediaItem
    var width: CGFloat = 262
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        Button {
            router.open(item)
        } label: {
            ZStack(alignment: .bottomLeading) {
                ArtworkView(url: item.backdropURL ?? item.posterURL, cornerRadius: 10)
                    .frame(width: width, height: width * 0.5625)

                LinearGradient(
                    colors: [.clear, .black.opacity(0.18), .black.opacity(0.80)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.displayTitle)
                        .font(.system(size: 14.25, weight: .semibold))
                        .tracking(-0.2)
                        .lineLimit(1)
                    if !item.year.isEmpty {
                        Text(item.year)
                            .font(.system(size: 10.5, weight: .medium))
                            .foregroundStyle(.white.opacity(0.56))
                    }
                }
                .foregroundStyle(.white)
                .padding(11)
                .frame(width: width, alignment: .leading)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(.white.opacity(0.045), lineWidth: 0.55)
            }
        }
        .buttonStyle(MediaPressStyle())
        .accessibilityLabel(item.displayTitle)
    }
}

struct MediaShelf: View {
    let title: String
    let items: [MediaItem]
    var landscape = false
    var cardWidth: CGFloat? = nil
    var edgePadding: CGFloat? = nil
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        if !items.isEmpty {
            let edge = edgePadding ?? (horizontalSizeClass == .regular ? 34 : 18)
            let width = cardWidth ?? (landscape
                ? (horizontalSizeClass == .regular ? 296 : 248)
                : (horizontalSizeClass == .regular ? 166 : 136))
            let spacing: CGFloat = horizontalSizeClass == .regular ? 13 : 10

            VStack(alignment: .leading, spacing: horizontalSizeClass == .regular ? 11 : 9) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(title)
                        .font(.system(size: horizontalSizeClass == .regular ? 20 : 18, weight: .bold))
                        .tracking(horizontalSizeClass == .regular ? -0.48 : -0.38)
                        .foregroundStyle(.white)

                    Image(systemName: "chevron.right")
                        .font(.system(size: horizontalSizeClass == .regular ? 10 : 9, weight: .bold))
                        .foregroundStyle(.white.opacity(0.25))
                }
                .padding(.horizontal, edge)

                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(alignment: .top, spacing: spacing) {
                        ForEach(items) { item in
                            if landscape {
                                LandscapeCard(item: item, width: width)
                            } else {
                                PosterCard(item: item, width: width, showMeta: false)
                            }
                        }
                    }
                    .padding(.horizontal, edge)
                    .padding(.bottom, 3)
                }
            }
        }
    }
}

struct GlassIconButton: View {
    let symbol: String
    let label: String
    var tint: Color? = nil
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 14.5, weight: .semibold))
                .foregroundStyle(.white.opacity(0.92))
                .frame(width: 40, height: 40)
                .contentShape(Circle())
        }
        .buttonStyle(MediaPressStyle())
        .synflixCircleGlass(tint: tint)
        .accessibilityLabel(label)
    }
}

struct AccentActionButton: View {
    let title: String
    let symbol: String
    let accent: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: symbol)
                    .font(.system(size: 13.25, weight: .bold))
                Text(title)
                    .font(.system(size: 13.25, weight: .bold))
            }
            .foregroundStyle(.black)
            .padding(.horizontal, 18)
            .frame(height: 42)
            .background(accent, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(MediaPressStyle())
    }
}

struct GlassActionButton: View {
    let title: String
    let symbol: String
    var tint: Color? = nil
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: symbol)
                    .font(.system(size: 13.25, weight: .semibold))
                Text(title)
                    .font(.system(size: 13.25, weight: .semibold))
            }
            .foregroundStyle(.white.opacity(0.94))
            .padding(.horizontal, 17)
            .frame(height: 42)
            .contentShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(MediaPressStyle())
        .synflixGlass(tint: tint, cornerRadius: 10, interactive: true)
    }
}

struct NativeLoadingView: View {
    var text = "Loading"
    @EnvironmentObject private var theme: ThemeStore

    var body: some View {
        VStack(spacing: 12) {
            SynFlixBrandMark(size: 46)
            ProgressView().tint(theme.accent)
            Text(text)
                .font(.system(size: 11.5, weight: .medium))
                .foregroundStyle(.white.opacity(0.40))
        }
    }
}

struct ErrorPanel: View {
    let title: String
    let message: String
    let retry: () -> Void
    @EnvironmentObject private var theme: ThemeStore

    var body: some View {
        VStack(spacing: 13) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 23, weight: .semibold))
                .foregroundStyle(theme.accent)
            Text(title)
                .font(.system(size: 18, weight: .bold))
            Text(message)
                .font(.system(size: 12.5))
                .foregroundStyle(.white.opacity(0.50))
                .multilineTextAlignment(.center)
            GlassActionButton(title: "Try Again", symbol: "arrow.clockwise", tint: theme.accent.opacity(0.05), action: retry)
        }
        .padding(22)
        .frame(maxWidth: 360)
        .synflixGlass(tint: theme.accent.opacity(0.025), cornerRadius: 18)
    }
}
