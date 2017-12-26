import * as fs from 'fs-extra'
import * as Asciidoctor from 'asciidoctor.js'
import * as escapeHtml from 'escape-html'

const AsciidoctorEngine: Function = function (filePath: string, options: { [key: string]: string }, callback: Function): void {
  fs.readFile(filePath, 'utf8', function (err: NodeJS.ErrnoException, content: string): void {
    if (err) return callback(err)

    const renderer = Asciidoctor()
    renderer.Extensions.register(function (this: any): void {
      const extension = this
      extension.inlineMacro(function (this: any) {
        const macro = this
        macro.named('var')

        macro.process(function (parent: object, target: string, attrs: object): string {
          return attrs['$$smap'].raw === 'true' ? escapeHtml(options[target]) : options[target]
        })
      })
    })

    return callback(null, renderer.convert(content, { safe: 'unsafe', header_footer: true }))
  })
}

export default AsciidoctorEngine
