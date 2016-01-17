/*
 * List features that require a modern browser, and if the current browser support them.
 *
 * This checking logic is ported from JSZip
 * It contains boolean values they shows the feature is spported or not.
 */
native class BinarySupport {
    static __readonly__ var arraybuffer : boolean;
    static __readonly__ var nodebuffer : boolean;
    static __readonly__ var uint8array : boolean;
    static __readonly__ var blob : boolean;
} = '''
{
   arraybuffer : (function(){
      return typeof ArrayBuffer !== "undefined" && typeof Uint8Array !== "undefined";
   })(),
   nodebuffer : (function(){
      return typeof Buffer !== "undefined";
   })(),
   uint8array : (function(){
      return typeof Uint8Array !== "undefined";
   })(),
   blob : (function(){
      if (typeof ArrayBuffer === "undefined") {
         return false;
      }
      var buffer = new ArrayBuffer(0);
      try {
         return new Blob([buffer], { type: "application/zip" }).size === 0;
      }
      catch(e) {}
      return false;
   })()
}''';
