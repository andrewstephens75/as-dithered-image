const DITHERED_IMAGE_STYLE = `
.ditheredImageStyle {
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    image-rendering: crisp-edges;
}
`

class ASDitheredImage extends HTMLElement {
    constructor() {
        super()

        // the canvas API is confusing if you want pixel accurate drawing. The canvas backing store must be set to the screen size * the devicePixelRatio
        // The crunch factor is how "chunky" the dither should be, ie how many css pixels to dithered pixels
        this.crunchFactor = this.getAutoCrunchFactor()
        this.drawTimestamp = 0
        this.drawRect = undefined
        this.drawCrunchFactor = undefined
        this.drawSrc = undefined
        this.altText = ""
        this.forceRedraw = false
        this.originalImage = new Image(100, 100)
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
        this.canvas.setAttribute("role", "image")
        this.canvas.setAttribute("aria-label", this.altText)
        this.canvas.classList.add("ditheredImageStyle")
        shadowDOM.appendChild(this.canvas)

        this.context = this.canvas.getContext("2d")

        const resizeObserver = new ResizeObserver((entries) => {
            for (const e of entries) {
                if (e.contentBoxSize) {
                    this.requestUpdate()
                }
            }
        })

        resizeObserver.observe(this.canvas)

        this.requestUpdate()

    }

    static get observedAttributes() { return ["src", "crunch", "alt"] }


    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return

        if ((name === "src")) {
            this.src = newValue
            this.loadImage()
        } else if (name === "crunch") {
            if (newValue === "auto") {
                this.crunchFactor = this.getAutoCrunchFactor()
            } else if (newValue === "pixel") {
                this.crunchFactor = 1.0 / this.getDevicePixelRatio()
            } else {
                this.crunchFactor = parseInt(newValue, 10)
                if (isNaN(this.crunchFactor)) {
                    this.crunchFactor = this.getAutoCrunchFactor()
                }
            }
            this.requestUpdate()
        } else if (name === "alt") {
            this.altText = newValue;
            if (this.canvas != undefined) {
                let currentAltText = this.canvas.getAttribute("aria-label")
                if (currentAltText != this.altText) {
                    this.canvas.setAttribute("aria-label", this.altText)
                }
            }
        }
    }

    // all drawing is funneled through requestUpdate so that multiple calls are coalesced to prevent
    // processing the image multiple times for no good reason
    requestUpdate() {
        window.requestAnimationFrame(((timestamp) => {
            if (this.drawTimestamp != timestamp) {
                this.drawImage()
                this.drawTimestamp = timestamp
            }
        }).bind(this))
    }

    // The crunch factor defaults 1 css pixel to 1 dither pixel which I think looks best when the device pixel ratio is 1 or 2
    // If the pixel ratio is 3 or above (like on my iPhone) then even css pixels are too small to make dithering
    // look effective, so I double the pixels again
    getAutoCrunchFactor() {
        if (this.getDevicePixelRatio() < 3) {
            return 1
        } else {
            return 2
        }
    }


    loadImage() {
        const image = new Image()
        image.onload = (() => {
            this.originalImage = image
            this.forceRedraw = true
            this.style.aspectRatio = this.originalImage.width + "/" + this.originalImage.height
            this.forceRedraw = true
            console.log(this.width, " x ", this.height)
            requestUpdate()
        }).bind(this)
        image.src = this.src
    }

    refreshImage() {
        if ((this.canvas === undefined) || (this.src === undefined)) {
            return
        }
        const rect = this.canvas.getBoundingClientRect()

        // we only want to draw the image if something has actually changed (usually the size)
        if ((this.drawRect != undefined) && (rect.width == this.drawRect.width) && (rect.height == this.drawRect.height) &&
            ((this.drawCrunchFactor != undefined) && (this.crunchFactor === this.drawCrunchFactor)) &&
            ((this.drawSrc != undefined && this.src === this.drawSrc))) {
            return
        }

        this.drawRect = rect
        this.drawCrunchFactor = this.crunchFactor
        this.drawSrc = this.src

        // to get really crisp pixels on retina-type displays (window.devicePixelRatio > 1) we have to set the
        // canvas backing store to the element size times the devicePixelRatio
        // Then, once the image has loaded we draw it manually scaled to only part of the canvas (since the canvas is bigger than the element)
        // The dithering algorithm will scale up the image to the canvas size
        const logicalPixelSize = this.getDevicePixelRatio() * this.crunchFactor
        this.canvas.width = rect.width * this.getDevicePixelRatio()
        this.canvas.height = rect.height * this.getDevicePixelRatio()


        const image = new Image()
        image.onload = (() => {
            this.context.imageSmoothingEnabled = true
            this.context.drawImage(image, 0, 0, this.canvas.width / logicalPixelSize, this.canvas.height / logicalPixelSize)
            const original = this.context.getImageData(0, 0, this.canvas.width / logicalPixelSize, this.canvas.height / logicalPixelSize)

            const dithered = this.dither(original, logicalPixelSize)
            this.context.imageSmoothingEnabled = false
            this.context.putImageData(dithered, 0, 0)
        }).bind(this)

        image.src = this.src
    }


    dither(imageData, scaleFactor) {
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

}

window.customElements.define('as-dithered-image', ASDitheredImage);

