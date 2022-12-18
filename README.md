# Custom HTML Element for Client-side Atkinson Dithering

There are many dithering algorithms to crush multi-colored images down to black and which but the one I like best was introduce with the original Apple Macintosh for its crisp 512x342 monochrome dispay. One of Apple's engineers, [Bill Atkinson](https://en.wikipedia.org/wiki/Bill_Atkinson), developed what came to be known as Atkinson Dithering, a good trade-off between fast and accurate with results prossessing a certain charm that on-paper "better" dithers cannot match.

I wanted to bring this to the web.

## Why Do This Client Side?

You can pre-dither your images but this gives bad results because dithering relies on the precise corrispondence between the source and out pixels. Unless you can guarentee that your image will be displayed at exactly the same size (in pixels) as it was output, the pixels of the image will not align with the pixels of your screen and the results will be either blury or fulled with weird patterns. The technical term for this is aliasing but whatever you call it, it ruins your image. 

The only way to get really crisp results in a web browser is to dither the source image to the exact pixel size of the element when it is displayed.

## Why as-dithered-image?

There is other javascript floating around out there that does much the same thing. as-dithered-image has a few advantages:

* I put some effort into getting really crisp results even on high-DPI displays. Most of the other code looks slightly blurry due to not taking this into account.
* Resizing is completely supported, allowing for dithered images in responsive designs.
* Accessibility is supported with the **alt** tag.
* Some control over the look of the dither is supported with the **crunch** attribute.

## Usage

Example usage:

```
<script src="as-dithered-image.js"></script>

...

<style>
    .canvasstyle {
        display: inline-block;
        width: 90%;
        aspect-ratio: 640 / 954;
        min-width: 90%;
        padding: auto;
        margin: auto;
    }
</style>

...

<as-dithered-image src="mypicture.jpg" alt="Description of the image for screen readers" crunch="2" class="canvasstyle"></as-dithered-image>
```

as-dithered-image takes 3 attributes:

 * **src** the url of the image
 * **alt** the alt text, important for screen readers
 * **crunch** an integer to control the size of the dithered pixels relative to screen pixels, setting this to 1 means the image will be dithered to screen pixels. 2 dithers the images as if the pixels were twice as big, etc. There are two special values. 
 
   * **auto** (the default) attempts to give good results on very high-DPI screens (like iPhones) which have such small pixels that standard dithering just looks grey. It is equivalent of 1 on most displays and 2 on devices where the ratio of screen to css pixels is 3 or more.
   * **pixel** dither to screen pixels. This can either look amazing or wasted depending on the size of the screen but you paid for all the pixels so you might as well use them.

## Downsides

As it stands, as-dithered-image as a few warts. The size of the source image is not taken into account, you must set the size in the CSS.

Dithering is not free, processing the image takes time. Currently this is done on the main UI thread of the browser which can lead to poor UI performance. This processing could be moved to a background thread but I got lazy.

## License 

Do what you want with this code.