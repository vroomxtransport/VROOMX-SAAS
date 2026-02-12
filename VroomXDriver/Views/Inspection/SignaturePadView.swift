import SwiftUI
import UIKit

// MARK: - Signature Pad View

/// Reusable canvas-based signature capture component.
/// Used in both driver review (step 5) and customer sign-off (step 6).
/// Exports the drawn signature as a UIImage via a binding.
struct SignaturePadView: View {
    @Binding var signatureImage: UIImage?

    @State private var lines: [[CGPoint]] = []
    @State private var currentLine: [CGPoint] = []
    @State private var isDone: Bool = false

    /// Minimum number of distinct strokes required before allowing "Done".
    private let minimumStrokes = 2

    /// Ink line width for the signature.
    private let lineWidth: CGFloat = 2.0

    var body: some View {
        VStack(spacing: 12) {
            // Drawing canvas
            ZStack {
                // White background
                Color.white
                    .cornerRadius(8)

                // Placeholder text when empty
                if lines.isEmpty && currentLine.isEmpty {
                    Text("Sign here")
                        .font(.vroomxBody)
                        .foregroundColor(Color.gray.opacity(0.4))
                }

                // Drawing layer
                Canvas { context, size in
                    // Draw completed lines
                    for line in lines {
                        drawLine(line, in: &context)
                    }
                    // Draw current line being drawn
                    if !currentLine.isEmpty {
                        drawLine(currentLine, in: &context)
                    }
                }
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            guard !isDone else { return }
                            currentLine.append(value.location)
                        }
                        .onEnded { _ in
                            guard !isDone else { return }
                            if currentLine.count > 1 {
                                lines.append(currentLine)
                            }
                            currentLine = []
                        }
                )
            }
            .aspectRatio(3, contentMode: .fit)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.textSecondary.opacity(0.3), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))

            // Buttons
            HStack(spacing: 16) {
                // Clear button
                Button {
                    clearSignature()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "arrow.counterclockwise")
                        Text("Clear")
                    }
                    .font(.vroomxBodyBold)
                    .foregroundColor(.brandDanger)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color.brandDanger.opacity(0.1))
                    .cornerRadius(10)
                }
                .disabled(lines.isEmpty && currentLine.isEmpty)

                // Done button
                Button {
                    exportSignature()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Done")
                    }
                    .font(.vroomxBodyBold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(canFinalize ? Color.brandSuccess : Color.textSecondary.opacity(0.3))
                    .cornerRadius(10)
                }
                .disabled(!canFinalize)
            }

            // Stroke count hint
            if !canFinalize && !lines.isEmpty {
                Text("Please add at least \(minimumStrokes) strokes to complete your signature")
                    .font(.vroomxCaption)
                    .foregroundColor(.textSecondary)
            }
        }
    }

    // MARK: - Computed

    /// Whether the minimum stroke count has been met.
    private var canFinalize: Bool {
        lines.count >= minimumStrokes && !isDone
    }

    // MARK: - Drawing

    /// Draws a single line (array of points) into the canvas context.
    private func drawLine(_ points: [CGPoint], in context: inout GraphicsContext) {
        guard points.count > 1 else { return }

        var path = Path()
        path.move(to: points[0])

        for i in 1..<points.count {
            path.addLine(to: points[i])
        }

        context.stroke(
            path,
            with: .color(.black),
            lineWidth: lineWidth
        )
    }

    // MARK: - Actions

    /// Clears all drawn lines and resets the signature.
    private func clearSignature() {
        lines = []
        currentLine = []
        isDone = false
        signatureImage = nil
    }

    /// Exports the current drawing as a UIImage using UIGraphicsImageRenderer.
    private func exportSignature() {
        // Calculate the render size based on a 3:1 aspect ratio
        let renderWidth: CGFloat = 600
        let renderHeight: CGFloat = 200

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: renderWidth, height: renderHeight))

        let image = renderer.image { rendererContext in
            // White background
            UIColor.white.setFill()
            rendererContext.fill(CGRect(x: 0, y: 0, width: renderWidth, height: renderHeight))

            // Draw all lines
            let cgContext = rendererContext.cgContext
            cgContext.setStrokeColor(UIColor.black.cgColor)
            cgContext.setLineWidth(lineWidth)
            cgContext.setLineCap(.round)
            cgContext.setLineJoin(.round)

            // We need to scale points from the canvas coordinate space
            // to the render coordinate space. Since we render at a fixed size,
            // we assume the canvas was displayed at its natural aspect ratio.
            // For simplicity, we use the same coordinate space (points map 1:1
            // within the aspect-ratio-constrained area).
            for line in lines {
                guard line.count > 1 else { continue }
                cgContext.beginPath()
                cgContext.move(to: line[0])
                for i in 1..<line.count {
                    cgContext.addLine(to: line[i])
                }
                cgContext.strokePath()
            }
        }

        isDone = true
        signatureImage = image
    }
}

// MARK: - Preview

#Preview {
    struct PreviewWrapper: View {
        @State private var signature: UIImage?

        var body: some View {
            VStack {
                SignaturePadView(signatureImage: $signature)
                    .padding()

                if let sig = signature {
                    Image(uiImage: sig)
                        .resizable()
                        .aspectRatio(3, contentMode: .fit)
                        .border(Color.gray)
                        .padding()
                }
            }
        }
    }

    return PreviewWrapper()
}
