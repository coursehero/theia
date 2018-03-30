abstract class Storage {
  abstract copy (componentLibrary: string, file: string): Promise<void>
  abstract exists (componentLibrary: string, basename: string): Promise<boolean>
  abstract load (componentLibrary: string, basename: string): Promise<string>
  abstract write (componentLibrary: string, basename: string, contents: string): Promise<void>
}

export default Storage
