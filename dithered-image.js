const DITHERED_IMAGE_STYLE = `
.ditheredImageStyle {
    width: 100%;
    height: 100%;
    padding: none
    margin: none

}
`

class ASDitheredImage extends HTMLElement {
    constructor() {
        super()
    }

    connectedCallback() {
        if (!this.isConnected) {
            return
        }

        const shadowDOM = this.attachShadow({ mode: "open" })

        const style = document.createElement("style")
        style.innerHTML = DITHERED_IMAGE_STYLE
        shadowDOM.appendChild(style)

        this.canvas = document.createElement("canvas")
        this.canvas.classList.add("ditheredImageStyle")
        shadowDOM.appendChild(this.canvas)

        this.context = this.canvas.getContext("2d")

        this.drawImage(this.src)

        const resizeObserver = new ResizeObserver((entries) => {
            for (const e of entries) {
                if (e.contentBoxSize) {
                    console.log("resize to ", e.contentBoxSize[0])
                    this.drawImage(this.src)
                }
            }
        })

        resizeObserver.observe(this.canvas)

    }

    attributeChangedCallback(name, oldValue, newValue) {
        if ((name === "src") && (oldValue !== newValue)) {
            this.src = newValue
            this.drawImage(this.src)
        } else {
            console.log(name)
        }
    }

    drawImage(src) {
        if ((this.canvas === undefined) || (this.src === undefined)) {
            return
        }
        const rect = this.canvas.getBoundingClientRect()
        // to get really crisp pixels on retina-type displays (window.devicePixelRatio > 1) we have to set the
        // canvas backing store to the element size times the devicePixelRatio
        // Then, once the image has loaded we draw it manually scaled to only part of the canvas (since the canvas is bigger than the element)
        // The dithering algorythm will scale up the image to the canvas size

        const logicalPixelSize = window.devicePixelRatio

        this.canvas.width = rect.width * logicalPixelSize
        this.canvas.height = rect.height * logicalPixelSize

        const image = new Image()
        image.onload = (() => {
            this.context.imageSmoothingEnabled = true
            this.context.drawImage(image, 0, 0, this.canvas.width / logicalPixelSize, this.canvas.height / logicalPixelSize)
            console.log(this.canvas.width, this.canvas.height)
            const original = this.context.getImageData(0, 0, this.canvas.width / logicalPixelSize, this.canvas.height / logicalPixelSize)

            const dithered = this.dither(original, logicalPixelSize)
            console.log(dithered.width, dithered.height)
            this.context.imageSmoothingEnabled = false
            this.context.putImageData(dithered, 0, 0)
        }).bind(this)

        image.src = src
    }

    static get observedAttributes() { return ["src"] }

    dither(imageData, scaleFactor) {
        let output = new ImageData(imageData.width * scaleFactor, imageData.height * scaleFactor)
        for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = imageData.data[i + 1] = imageData.data[i + 2] = Math.floor(imageData.data[i] * 0.3 + imageData.data[i + 1] * 0.59 + imageData.data[i + 2] * 0.11)
        }
        console.log("grey")



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
                // which gives us blury pixels (and it doesn't support the createImageBitmap call with an ImageData instance which
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
        console.log("done")
        return output
    }

}


window.customElements.define('as-dithered-image', ASDitheredImage);

