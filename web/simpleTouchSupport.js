// @ts-check
/** @type {any} */
const { self } = window

/** @type {import("../../../web/types/litegraph")} */
const { LGraphCanvas } = self

// @ts-ignore
import * as ComfyUI_module from "../../../scripts/app.js"
/** @type { import("../../../web/scripts/app.js") } */
const { app } = ComfyUI_module

/**
 * Smooth zooming for touchscreen
 */
let touchZooming;
let touchCount = 0;
app.registerExtension({
  name: "Comfy.SimpleTouchSupportFox",
  setup() {
    let touchDist
    let touchTime
    let lastTouch
    let lastScale
    function getMultiTouchPos(e) {
      return Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
    }

    function getMultiTouchCenter(e) {
      return {
        clientX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        clientY: (e.touches[0].clientY + e.touches[1].clientY) / 2
      }
    }

    app.canvasEl.addEventListener(
      'touchstart',
      (e) => {
        touchCount++
        lastTouch = null
        lastScale = null
        if (e.touches?.length === 1) {
          // Store start time for press+hold for context menu
          touchTime = new Date()
          lastTouch = e.touches[0]
        } else {
          touchTime = null
          if (e.touches?.length === 2) {
            // Store center pos for zoom
            lastScale = app.canvas.ds.scale
            lastTouch = getMultiTouchCenter(e)

            touchDist = getMultiTouchPos(e)
            app.canvas.pointer_is_down = false
          }
        }
      },
      true
    )

    app.canvasEl.addEventListener('touchend', (e) => {
      touchCount = e.touches?.length ?? touchCount - 1

      if (e.touches?.length !== 1) touchZooming = false
      if (touchTime && !e.touches?.length) {
        if (new Date().getTime() - touchTime > 600) {
          try {
            // hack to get litegraph to use this event
            e.constructor = CustomEvent
          } catch (error) { }
          e.clientX = lastTouch.clientX
          e.clientY = lastTouch.clientY

          app.canvas.pointer_is_down = true
          app.canvas._mousedown_callback(e)
        }
        touchTime = null
      }
    })

    app.canvasEl.addEventListener(
      'touchmove',
      (e) => {
        touchTime = null
        if (e.touches?.length === 2) {
          app.canvas.pointer_is_down = false
          touchZooming = true
          // @ts-expect-error
          LiteGraph.closeAllContextMenus()
          app.canvas.search_box?.close()
          const newTouchDist = getMultiTouchPos(e)

          const center = getMultiTouchCenter(e)

          let scaleDiff = app.canvas.ds.scale
          const oldScale = app.canvas.ds.scale

          scaleDiff = lastScale * newTouchDist / touchDist

          const newX = (center.clientX - lastTouch.clientX) / scaleDiff
          const newY = (center.clientY - lastTouch.clientY) / scaleDiff

          if (scaleDiff < app.canvas.ds.min_scale)
            scaleDiff = app.canvas.ds.min_scale
          else if (scaleDiff > app.canvas.ds.max_scale)
            scaleDiff = app.canvas.ds.max_scale

          app.canvas.ds.scale = scaleDiff

          // Code from LiteGraph
          if (Math.abs(app.canvas.ds.scale - 1) < 0.01) {
            app.canvas.ds.scale = 1
          }

          const newScale = app.canvas.ds.scale

          const convertScaleToOffset = scale => [
            center.clientX / scale - app.canvas.ds.offset[0],
            center.clientY / scale - app.canvas.ds.offset[1]
          ]
          var oldCenter = convertScaleToOffset(oldScale)
          var newCenter = convertScaleToOffset(newScale)

          app.canvas.ds.offset[0] += newX + newCenter[0] - oldCenter[0]
          app.canvas.ds.offset[1] += newY + newCenter[1] - oldCenter[1]

          lastTouch.clientX = center.clientX
          lastTouch.clientY = center.clientY

          app.canvas.setDirty(true, true)
        }
      },
      true
    )
  }
});
const processMouseDown = LGraphCanvas.prototype.processMouseDown;
LGraphCanvas.prototype.processMouseDown = function (e) {
  if (touchZooming || touchCount) {
    return;
  }
  return processMouseDown.apply(this, arguments);
};
const processMouseMove = LGraphCanvas.prototype.processMouseMove;
LGraphCanvas.prototype.processMouseMove = function (e) {
  if (touchZooming || touchCount > 1) {
    return;
  }
  return processMouseMove.apply(this, arguments);
};