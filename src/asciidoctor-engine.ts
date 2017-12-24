import * as fs from 'fs-extra'
import * as Asciidoctor from 'asciidoctor.js'

const AsciidoctorEngine = function(filePath, options, callback) {
  fs.readFile(filePath, function(err, content) {
    if (err) return callback(err)

    const renderer = Asciidoctor()
    renderer.Extensions.register(function() {
      this.inlineMacro(function() {
        const macro = this
        macro.named('var')

        macro.process(function(parent, target, attrs) {
          return options[target]
        })
      })
    })

    return callback(null, renderer.convert(content.toString()))
  })
}

export default AsciidoctorEngine
