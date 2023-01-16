# Custom HTML Element for Client-side Atkinson Dithering

There are many dithering algorithms to crush multi-colored images down to black and which but the one I like best was introduce with the original Apple Macintosh for its crisp 512x342 monochrome display. One of Apple's engineers, [Bill Atkinson](https://en.wikipedia.org/wiki/Bill_Atkinson), developed what came to be known as Atkinson Dithering, a good trade-off between fast and accurate with results possessing a certain charm that on-paper "better" dithers cannot match.

I wanted to bring this to the web. For some examples of how to use this project see [my blog post on the subject](https://sheep.horse/2022/12/pixel_accurate_atkinson_dithering_for_images_in_ht.html).

## Why Do This Client Side?

You can pre-dither your images but this gives bad results because dithering relies on the precise correspondence between the source and out pixels. Unless you can guarantee that your image will be displayed at exactly the same size (in pixels) as it was output, the pixels of the image will not align with the pixels of your screen and the results will be either blurry or fulled with weird patterns. The technical term for this is aliasing but whatever you call it, it ruins your image. 

The only way to get really crisp results in a web browser is to dither the source image to the exact pixel size of the element when it is displayed.

## Why as-dithered-image?

There is other javascript floating around out there that does much the same thing. as-dithered-image has a few advantages:

* I put some effort into getting really crisp results even on high-DPI displays. Most of the other code out there looks slightly blurry due to not taking this into account.
* Resizing is completely supported, allowing for dithered images in responsive designs. The element automatically adjusts its aspect ratio based on the image.
* Dithering is performed in a web worker so as to not block rendering of the rest of the page.
* as-dithered-image elements that are completely offscreen are not dithered until they are just about to scroll into view
* Accessibility is supported with the **alt** tag.
* Some control over the look of the dither is supported with the **crunch** and **cutoff** attributes.

## Usage

You will need to copy the following two files into your web project, they should be placed together in the same directory.

* as-dithered-image.js
* ditherworker.js

Example usage:

```
<script src="as-dithered-image.js"></script>

<as-dithered-image src="mypicture.jpg" alt="Description of the image for screen readers"></as-dithered-image>
```

as-dithered-image takes 4 attributes:

 * **src** the url of the image. Can be a data url.
 * **alt** the alt text, important for screen readers.
 * **crunch** controls the size of the logical pixels the image is dithered into. May be one of: 
   * an integer, where 1 means dither to logical css pixels no matter what the DPI. 2 makes the logical pixels twice the size, for a coarser look. 3 is really blocky.
   * **auto** (the default) attempts to give good results on very high-DPI screens (like iPhones) which have such small pixels that standard dithering just looks grey. It is equivalent of 1 on most displays and 2 on devices where the ratio of screen to css pixels is 3 or more.
   * **pixel** dither to screen pixels. This can either look amazing or be completely wasted depending on the size of the screen but you paid for all the pixels so you might as well use them.
* **cutoff** a float between 0 and 1, defaulting to 0.5. Controls the cutoff the dithering algorithm uses to determine whether a pixel is black or white. Modifying this will produce either a lighter or darker image.

## Legal 

See LICENSE file for usage.

