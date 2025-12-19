import { exec } from "child_process"
import path from "path"
import fs from "fs"

export const normalizeVideoForIOS = (inputPath) => {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath.replace(/\.[^/.]+$/, "-ios.mp4")

    const cmd = `
      ffmpeg -y -err_detect ignore_err -fflags +genpts -i "${inputPath}"
      -map 0:v:0 -map 0:a?
      -c:v libx264
      -profile:v baseline
      -level 3.0
      -pix_fmt yuv420p
      -preset veryfast
      -crf 28
      -movflags +faststart
      -c:a aac -b:a 128k
      "${outputPath}"
    `

    exec(cmd, (err) => {
      if (err) {
        return reject(err)
      }

      resolve(outputPath)
    })
  })
}
