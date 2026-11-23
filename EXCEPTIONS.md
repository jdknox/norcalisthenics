# Approved website exceptions

- Barcode scanner (admin test and regular add-pantry-item form): use the native Promise-based `navigator.mediaDevices.getUserMedia()` and `BarcodeDetector.detect()` APIs only to obtain camera frames and read barcodes. The user explicitly approved each API in this conversation on 2026-11-23, then requested reuse of the working scanner in the regular add-pantry-item pathway. Keep the Promise-based camera and detection code isolated inside its existing block-comment guards.
