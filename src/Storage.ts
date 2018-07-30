interface Storage {
  copy (componentLibrary: string, file: string): Promise<void>
  exists (componentLibrary: string, basename: string): Promise<boolean>
  load (componentLibrary: string, basename: string): Promise<string>
  write (componentLibrary: string, basename: string, contents: string): Promise<void>
}

export default Storage
