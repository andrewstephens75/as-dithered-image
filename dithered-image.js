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
        this.canvas.width = rect.width * window.devicePixelRatio
        this.canvas.height = rect.height * window.devicePixelRatio

        this.canvas.width = Math.floor(this.canvas.width / 2)
        this.canvas.height = Math.floor(this.canvas.height / 2)

        const image = new Image()
        image.onload = (() => {
            this.context.imageSmoothingEnabled = true
            this.context.drawImage(image, 0, 0, this.canvas.width, this.canvas.height)
            console.log(this.canvas.width, this.canvas.height)
            const original = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height)

            const dithered = this.dither(original)
            this.context.imageSmoothingEnabled = false
            this.context.putImageData(dithered, 0, 0)
        }).bind(this)

        image.src = src
    }

    static get observedAttributes() { return ["src"] }

    dither(imageData) {
        let output = new ImageData(imageData.width, imageData.height)
        for (let i = 0; i < imageData.data.length; i += 4) {
            output.data[i] = output.data[i + 1] = output.data[i + 2] = Math.floor(imageData.data[i] * 0.3 + imageData.data[i + 1] * 0.59 + imageData.data[i + 2] * 0.11)
            output.data[i + 3] = imageData.data[i + 3]
        }
        console.log("grey")


        let slidingErrorWindow = [new Float32Array(imageData.width), new Float32Array(imageData.width), new Float32Array(imageData.width)]
        const offsets = [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]

        for (let y = 0, limY = imageData.height; y < limY; ++y) {
            for (let x = 0, limX = imageData.width; x < limX; ++x) {
                let i = ((y * limX) + x) * 4;
                let accumulatedError = Math.floor(slidingErrorWindow[0][x])
                let expectedMono = output.data[i] + accumulatedError
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

                output.data[i] = output.data[i + 1] = output.data[i + 2] = monoValue
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

