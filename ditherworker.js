onmessage = function (e) {
    console.log("Worker: start", e.data.imageData)

    const result = dither(e.data.imageData, e.data.pixelSize)
    const reply = {}
    reply.imageData = result
    postMessage(reply)
}

function dither(imageData, scaleFactor) {
    let output = new ImageData(imageData.width * scaleFactor, imageData.height * scaleFactor)
    for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = imageData.data[i + 1] = imageData.data[i + 2] = Math.floor(imageData.data[i] * 0.3 + imageData.data[i + 1] * 0.59 + imageData.data[i + 2] * 0.11)
    }

    // most implementations I see just distribute error into the existing image, wrapping around edge pixels
    // this implementation uses a sliding window of floats for more accuracy (probably not needed really)

    let slidingErrorWindow = [new Float32Array(imageData.width), new Float32Array(imageData.width), new Float32Array(imageData.width)]
    const offsets = [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]

    for (let y = 0, limY = imageData.height; y < limY; ++y) {
        for (let x = 0, limX = imageData.width; x < limX; ++x) {
            let i = ((y * limX) + x) * 4;
            let accumulatedError = Math.floor(slidingErrorWindow[0][x])
            let expectedMono = imageData.data[i] + accumulatedError
            let monoValue = expectedMono
            if (monoValue <= 127) {
                monoValue = 0
            } else {
                monoValue = 255
            }
            let error = (expectedMono - monoValue) / 8.0
            for (let q = 0; q < offsets.length; ++q) {
                let offsetX = offsets[q][0] + x
                let offsetY = offsets[q][1] + y
                if ((offsetX >= 0) && (offsetX < slidingErrorWindow[0].length))
                    slidingErrorWindow[offsets[q][1]][offsetX] += error
            }

            // this is stupid but we have to do the pixel scaling ourselves because safari insists on interpolating putImageData
            // which gives us blurry pixels (and it doesn't support the createImageBitmap call with an ImageData instance which
            // would make this easy)

            for (let scaleY = 0; scaleY < scaleFactor; ++scaleY) {
                let pixelOffset = (((y * scaleFactor + scaleY) * output.width) + (x * scaleFactor)) * 4
                for (let scaleX = 0; scaleX < scaleFactor; ++scaleX) {
                    output.data[pixelOffset] = output.data[pixelOffset + 1] = output.data[pixelOffset + 2] = monoValue
                    output.data[pixelOffset + 3] = 255
                    pixelOffset += 4
                }
            }
        }
        // move the sliding window
        slidingErrorWindow.push(slidingErrorWindow.shift())
        slidingErrorWindow[2].fill(0, 0, slidingErrorWindow[2].length)
    }
    return output
}