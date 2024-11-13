// @ts-check
/** @type {any} */
const { self } = window

// @ts-expect-error
/** @type {import("../../../web/types/litegraph")} */
const { LGraphCanvas, LiteGraph } = self

// @ts-ignore
import * as ComfyUI_module from "../../../scripts/app.js"
/** @type { import("../../../web/scripts/app.js") } */
const { app } = ComfyUI_module

/**
 * Smooth zooming for touchscreen
 */
let touchZooming
let touchCount = 0
let menuTouchDown = false

app.registerExtension({
  name: 'Comfy.SimpleTouchSupportFox',
  setup() {
    let touchDist
    let touchTime
    let lastTouch
    let lastScale
    function getMultiTouchDist(e) {
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

    function onTouchMove(e) {
      touchTime = null
      if (e.touches?.length === 2 && lastTouch && !e.ctrlKey && !e.shiftKey) {
        if (e.cancelable) e.preventDefault() // Prevent browser from zooming when two textareas are touched
        app.canvas.pointer_is_down = false
        touchZooming = true

        LiteGraph.closeAllContextMenus(window)
        app.canvas.search_box?.close()
        const newTouchDist = getMultiTouchDist(e)

        const center = getMultiTouchCenter(e)

        let scale = (lastScale * newTouchDist) / touchDist

        const newX = (center.clientX - lastTouch.clientX) / scale
        const newY = (center.clientY - lastTouch.clientY) / scale

        // Code from LiteGraph
        if (scale < app.canvas.ds.min_scale) {
          scale = app.canvas.ds.min_scale
        } else if (scale > app.canvas.ds.max_scale) {
          scale = app.canvas.ds.max_scale
        }

        const oldScale = app.canvas.ds.scale

        app.canvas.ds.scale = scale

        // Code from LiteGraph
        if (Math.abs(app.canvas.ds.scale - 1) < 0.01) {
          app.canvas.ds.scale = 1
        }

        const newScale = app.canvas.ds.scale

        const convertScaleToOffset = (scale) => [
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
    }

    function onTouchEnd(e) {
      touchCount--

      if (e.touches?.length !== 1) touchZooming = false
      if (touchTime && !e.touches?.length) {
        if (new Date().getTime() - touchTime > 600) {
          if (e.target === app.canvasEl) {
            app.canvasEl.dispatchEvent(
              new PointerEvent('pointerdown', {
                button: 2,
                clientX: e.changedTouches[0].clientX,
                clientY: e.changedTouches[0].clientY
              })
            )
            e.preventDefault()
          }
        }
        touchTime = null
      }
    }

    app.canvasEl.parentElement.addEventListener('touchstart', e => {
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

            touchDist = getMultiTouchDist(e)
            app.canvas.pointer_is_down = false
          }
        }
      },
      true
    )

    app.canvasEl.parentElement.addEventListener('touchend', onTouchEnd)
    app.canvasEl.parentElement.addEventListener('touchmove', onTouchMove, true)
    app.canvasEl.addEventListener('touchmove', onTouchMove, true)

    // Touch support for legacy menu
    const comfyMenu = document.getElementsByClassName("comfy-menu")[0];
    const draghandle = document.getElementsByClassName("drag-handle")[0];
    // @ts-expect-error
    comfyMenu.style.userSelect = "none"
    comfyMenu.addEventListener('touchstart', e => {
      menuTouchDown = true
      draghandle.dispatchEvent(new MouseEvent('mousedown', {
        clientX: e.touches[0].clientX,
        clientY: e.touches[0].clientY
      }))
    })

    comfyMenu.addEventListener('touchmove', e => {
      
      if (menuTouchDown) {
        e.preventDefault()
        document.dispatchEvent(new MouseEvent('mousemove', {
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY
        }))
      }
    })

    comfyMenu.addEventListener('touchend', e => {
      if (e.touches?.length === 0) {
        document.dispatchEvent(new MouseEvent('mouseup'))
        menuTouchDown = false
      }
    })
  }
})

const processMouseDown = LGraphCanvas.prototype.processMouseDown
LGraphCanvas.prototype.processMouseDown = function (e) {
  if (touchZooming || touchCount) {
    return
  }
  app.canvas.pointer_is_down = false // Prevent context menu from opening on second tap
  return processMouseDown.apply(this, arguments)
}

const processMouseMove = LGraphCanvas.prototype.processMouseMove
LGraphCanvas.prototype.processMouseMove = function (e) {
  if (touchZooming || touchCount > 1) {
    return
  }
  return processMouseMove.apply(this, arguments)
}