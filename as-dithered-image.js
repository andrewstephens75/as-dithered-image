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

        this.original_image_ = undefined
        this.force_refresh_ = false
        this.crunchFactor_ = this.getAutoCrunchFactor()
        this.canvas_ = undefined
        this.context_ = undefined
        this.image_loading_ = false
        this.ignore_next_resize_ = false
        this.worker_ = new Worker("ditherworker.js")

        this.worker_.onmessage = ((e) => {
            const imageData = e.data.imageData
            this.context_.putImageData(imageData, 0, 0)
        }).bind(this)

        this.resizing_timeout_ = undefined
    }

    connectedCallback() {
        console.log("connectedCallback")
        if (!this.isConnected) {
            return
        }

        const shadowDOM = this.attachShadow({ mode: "open" })

        const style = document.createElement("style")
        style.innerHTML = DITHERED_IMAGE_STYLE
        shadowDOM.appendChild(style)

        this.canvas_ = document.createElement("canvas")
        this.canvas_.setAttribute("role", "image")
        this.canvas_.setAttribute("aria-label", this.getAttribute("alt"))
        this.canvas_.classList.add("ditheredImageStyle")
        shadowDOM.appendChild(this.canvas_)

        this.context_ = this.canvas_.getContext("2d")

        const resizeObserver = new ResizeObserver(((entries) => {
            // browsers generated lots of resize events but we don't want to start refreshing until
            // the user has stopped resizing the page

            if (entries.length > 0) {
                if (entries[0].contentBoxSize) {
                    console.log("contentRect=", entries[0].contentRect)

                    if (this.ignore_next_resize_ == true) {
                        this.ignore_next_resize_ = false
                        return
                    }
                    if (this.resizing_timeout_ != undefined) {
                        clearTimeout(this.resizing_timeout_)
                    }
                    this.resizing_timeout_ = setTimeout((() => {
                        this.resizing_timeout_ = undefined
                        this.force_refresh_ = true
                        this.requestUpdate()
                    }).bind(this), 200)
                }

            }
        }).bind(this))

        resizeObserver.observe(this.canvas_)
        this.force_refresh_ = true
        this.requestUpdate()

    }

    static get observedAttributes() { return ["src", "crunch", "alt"] }


    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return

        if ((name === "src")) {
            this.force_refresh_ = true
            this.requestUpdate()
        } else if (name === "crunch") {
            if (newValue === "auto") {
                this.crunchFactor_ = this.getAutoCrunchFactor()
            } else if (newValue === "pixel") {
                this.crunchFactor_ = 1.0 / this.getDevicePixelRatio()
            } else {
                this.crunchFactor_ = parseInt(newValue, 10)
                if (isNaN(this.crunchFactor_)) {
                    this.crunchFactor_ = this.getAutoCrunchFactor()
                }
            }
            this.force_refresh_ = true
            this.requestUpdate()
        } else if (name === "alt") {
            this.altText = newValue;
            if (this.canvas != undefined) {
                let currentAltText = this.canvas.getAttribute("aria-label")
                if (currentAltText != newValue) {
                    this.canvas.setAttribute("aria-label", newValue)
                }
            }
        }
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

    getDevicePixelRatio() {
        // this should always be an integer for the dithering code to work
        return Math.floor(window.devicePixelRatio)
    }

    // all drawing is funneled through requestUpdate so that multiple calls are coalesced to prevent
    // processing the image multiple times for no good reason
    requestUpdate() {
        console.log("requestUpdate")
        window.requestAnimationFrame(((timestamp) => {
            console.log(this.force_refresh_, this.isConnected)
            if ((this.force_refresh_ == false)) {
                return
            }
            console.log("update happening")
            if (this.original_image_ == undefined) {
                this.loadImage()
                return
            }
            if (this.force_refresh_) {
                this.repaintImage()
            }

        }).bind(this))
    }

    loadImage() {
        if (this.image_loading_ == true) {
            return
        }
        const image = new Image()
        image.onload = (() => {
            this.image_loading_ = false
            this.original_image_ = image
            this.ignore_next_resize_ = true
            console.log("set aspect ratio")
            this.style.aspectRatio = this.original_image_.width + "/" + this.original_image_.height
            this.force_refresh_ = true
            this.requestUpdate()
            console.log("Imaged Loaded")
        }).bind(this)
        image.onerror = (() => {
            this.image_loading_ == false
            this.original_image_ = undefined
        }).bind(this)
        this.image_loading_ = true
        console.log("Loading ", this.getAttribute("src"))
        image.src = this.getAttribute("src")
    }

    repaintImage() {
        const rect = this.canvas_.getBoundingClientRect()

        let screenPixelsToBackingStorePixels = this.getDevicePixelRatio()
        let fractionalPart = screenPixelsToBackingStorePixels - Math.floor(screenPixelsToBackingStorePixels)
        if (fractionalPart != 0) {
            screenPixelsToBackingStorePixels = Math.round(screenPixelsToBackingStorePixels * Math.round(1.0 / fractionalPart))
        }

        let adjustedPixelSize = screenPixelsToBackingStorePixels * this.crunchFactor_

        // this has to change for fractional device pixel ratios 
        this.canvas_.width = rect.width * screenPixelsToBackingStorePixels
        this.canvas_.height = rect.height * screenPixelsToBackingStorePixels

        this.context_.imageSmoothingEnabled = true
        this.context_.drawImage(this.original_image_, 0, 0, this.canvas_.width / adjustedPixelSize, this.canvas_.height / adjustedPixelSize)
        const originalData = this.context_.getImageData(0, 0, this.canvas_.width / adjustedPixelSize, this.canvas_.height / adjustedPixelSize)
        this.context_.fillStyle = "white"
        this.context_.fillRect(0, 0, this.canvas_.width, this.canvas_.height)
        // TODO: look at transferring the data in a different datastructure to prevent copying
        // unfortunately Safari has poor support for createImageBitmap - using it with ImageData doesn't work
        const msg = {}
        msg.imageData = originalData
        msg.pixelSize = adjustedPixelSize
        this.worker_.postMessage(msg)

        this.force_refresh_ = false
    }
}

window.customElements.define('as-dithered-image', ASDitheredImage);
