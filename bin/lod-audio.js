#! /usr/bin/env node

const opendata = require("lod-opendata")
const flow = require("xml-flow")
const { get } = require("https")
const path = require("path")
const tar = require("tar")
const fs = require("fs")

const hrstart = process.hrtime()
const infos = { noAudio: [], smallAudio: [], writeFail: [], countAudio: 0 }

const progress = progress => {
  process.stdout.clearLine()
  process.stdout.cursorTo(0)
  process.stdout.write(progress)
}

const feedBack = () => {
  const hrend = process.hrtime(hrstart)
  const time = new Date(hrend[0] * 1000).toISOString().substr(11, 8)

  process.stdout.cursorTo(0)
  process.stdout.clearLine()

  console.info("⦿ Execution time:", time)

  console.info("√ Mp3 files extracted: ", infos.countAudio)

  if (infos.smallAudio.length > 0)
    console.info("⁈ Files very small: ", infos.smallAudio.length, infos.smallAudio)

  if (infos.writeFail.length > 0)
    console.info("☓ Write files fail: ", infos.writeFail.length, infos.writeFail)

  if (infos.noAudio.length > 0)
    console.info("☓ Items without audio: ", infos.noAudio.length, infos.noAudio)

  process.stdout.write("\n")

  process.exit()
}

const main = async () => {
  process.on("SIGINT", feedBack)

  const fields = "resources/{url,format}"

  const {
    resources: [{ format, url }]
  } = await opendata(fields)

  const basedir = path.basename(url, `.${format}`)

  try {
    if (!fs.existsSync(basedir)) fs.mkdirSync(basedir)
  } catch (error) {
    console.error(error.message, "\n")
    process.exit()
  }

  const extract = item => {
    const { "lod:meta": { "lod:id": id = "" } = "", "lod:audio": { $text: audio = "" } = "" } = item

    if (!id || !audio) {
      infos.noAudio.push(id)
      return
    }

    const buff = new Buffer.from(audio, "base64")
    const filename = path.join(basedir, `${id}.mp3`)

    if (buff.length < 1000) infos.smallAudio.push(id)

    progress(id)

    try {
      fs.writeFileSync(filename, buff)
      infos.countAudio++
    } catch (err) {
      infos.writeFail.push(id)
    }
  }

  const tarStream = tar.t({ filter: path => /\.xml$/.test(path) })
  tarStream.on("entry", entry =>
    flow(entry)
      .on("tag:lod:item", extract)
      .on("end", feedBack)
  )

  get(url, resp => resp.pipe(tarStream))
}

main()
