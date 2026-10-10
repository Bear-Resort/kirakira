# Camera templates (CCD Cam)

Cut from two template sheets supplied by the site owner, who confirmed they may be used here.
Regenerate after replacing the sheets (higher-resolution originals will look sharper):

    node scripts/cut-cameras.mjs <sheet1.png> <sheet2.png>

The script removes the white background, finds each camera's screen (the biggest white area the
body encloses), makes it transparent and writes its four corners to `cameras.json`. Names live in
`js/tool-ccd.js` (`CAM_NAMES`) and the Chinese ones in `js/mobile/zh.js`.
