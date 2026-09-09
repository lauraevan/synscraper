import SwiftUI

struct ArtworkView: View {
    let url: URL?
    let cornerRadius: CGFloat

    init(url: URL?, cornerRadius: CGFloat = 12) {
        self.url = url
        self.cornerRadius = cornerRadius
    }

    var body: some View {
        AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.22))) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .scaledToFill()
            case .failure:
                placeholder
            case .empty:
                placeholder
                    .overlay {
                        ProgressView()
                            .controlSize(.small)
                            .tint(.white.opacity(0.55))
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
            colors: [Color.white.opacity(0.075), Color.white.opacity(0.025)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

struct PosterCard: View {
    let item: MediaItem
    var width: CGFloat = 142
    var showMeta: Bool = true
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        Button {
            router.open(item)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                ArtworkView(url: item.posterURL, cornerRadius: 11)
                    .frame(width: width, height: width * 1.50)
                    .overlay {
                        RoundedRectangle(cornerRadius: 11, style: .continuous)
                            .stroke(.white.opacity(0.065), lineWidth: 0.7)
                    }

                if showMeta {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(item.displayTitle)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.91))
                            .lineLimit(1)

                        HStack(spacing: 5) {
                            if !item.year.isEmpty { Text(item.year) }
                            if !item.year.isEmpty { Text("·") }
                            Text(item.kind == "tv" ? "Series" : "Movie")
                        }
                        .font(.system(size: 10.5, weight: .medium))
                        .foregroundStyle(.white.opacity(0.38))
                    }
                    .frame(width: width, alignment: .leading)
                }
            }
        }
        .buttonStyle(.plain)
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
                ArtworkView(url: item.backdropURL ?? item.posterURL, cornerRadius: 14)
                    .frame(width: width, height: width * 0.56)
                    .overlay {
                        LinearGradient(
                            colors: [.clear, .black.opacity(0.78)],
                            startPoint: .center,
                            endPoint: .bottom
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(.white.opacity(0.075), lineWidth: 0.7)
                    }

                VStack(alignment: .leading, spacing: 3) {
                    Text(item.displayTitle)
                        .font(.system(size: 15, weight: .semibold))
                        .lineLimit(1)
                    if !item.year.isEmpty {
                        Text(item.year)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.white.opacity(0.58))
                    }
                }
                .foregroundStyle(.white)
                .padding(12)
                .frame(width: width, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
    }
}

struct MediaShelf: View {
    let title: String
    let items: [MediaItem]
    var landscape = false
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(title)
                        .font(.system(size: horizontalSizeClass == .regular ? 22 : 19, weight: .bold))
                        .tracking(-0.45)
                        .foregroundStyle(.white)
                    Spacer()
                }
                .padding(.horizontal, horizontalSizeClass == .regular ? 28 : 18)

                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(alignment: .top, spacing: horizontalSizeClass == .regular ? 16 : 12) {
                        ForEach(items) { item in
                            if landscape {
                                LandscapeCard(item: item, width: horizontalSizeClass == .regular ? 320 : 252)
                            } else {
                                PosterCard(item: item, width: horizontalSizeClass == .regular ? 174 : 138)
                            }
                        }
                    }
                    .padding(.horizontal, horizontalSizeClass == .regular ? 28 : 18)
                    .padding(.bottom, 4)
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
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white.opacity(0.92))
                .frame(width: 42, height: 42)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
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
                    .font(.system(size: 14, weight: .bold))
                Text(title)
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(.black)
            .padding(.horizontal, 18)
            .frame(height: 44)
            .background(accent, in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
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
                    .font(.system(size: 14, weight: .semibold))
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
            }
            .foregroundStyle(.white.opacity(0.94))
            .padding(.horizontal, 17)
            .frame(height: 44)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .synflixGlass(tint: tint, cornerRadius: 22, interactive: true)
    }
}

struct NativeLoadingView: View {
    var text = "Loading"
    @EnvironmentObject private var theme: ThemeStore

    var body: some View {
        VStack(spacing: 14) {
            SynFlixBrandMark(size: 50)
            ProgressView()
                .tint(theme.accent)
            Text(text)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.white.opacity(0.42))
        }
    }
}

struct ErrorPanel: View {
    let title: String
    let message: String
    let retry: () -> Void
    @EnvironmentObject private var theme: ThemeStore

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 24, weight: .semibold))
                .foregroundStyle(theme.accent)
            Text(title)
                .font(.system(size: 19, weight: .bold))
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(.white.opacity(0.50))
                .multilineTextAlignment(.center)
            GlassActionButton(title: "Try Again", symbol: "arrow.clockwise", tint: theme.accent.opacity(0.12), action: retry)
        }
        .padding(24)
        .frame(maxWidth: 360)
        .synflixGlass(tint: theme.accent.opacity(0.045), cornerRadius: 26)
    }
}
