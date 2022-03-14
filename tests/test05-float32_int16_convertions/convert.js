/**
 * @author Sacchetto Matteo
 * @author Gastaldi Paolo
 * 
 * group all convertion functions
 */

'use strict';

// /**
//  * convert from Float32 to Int16
//  * @param {Float32} s32 - Float32 sample
//  * @returns {Int16} Int16 sample
// */
// exports.Float32ToInt16 = function Float32ToInt16(s32) {
//     // Convert the range [-1, 1] of Float32 in [-32768, 32767] of Int16
//     let s16 = Math.floor(((s32 + 1.) / 2. ) * 65535. - 32767.);
//     if(s32 < -1. || s32 > 1.) console.error(`Float32ToInt16, CLIPPING: ${s32}`);

//     // Just for safety
//     s16 = Math.min(32767., s16);
//     s16 = Math.max(-32768., s16);

//     return s16;
// }

// /**
//  * convert from Float32 to Int16
//  * @param {Int16} s16 - Int16 sample
//  * @returns {Float32} Float32 sample
//  */
//  exports.Int16ToFloat32 = function(s16) {
//     // Convert the range [-32768, 32767] of Int16 in [-1, 1] of Float32
//     let s32 = ((s16 + 32767.) / 65535.) / 2. - 1.;
//     if(s32 < -32768 || s32 > 32767) console.error(`Int16ToFloat32, CLIPPING: ${s32}`);

//     // Just for safety
//     s32 = Math.min(1., s32);
//     s32 = Math.max(-1., s32);

//     return s32;
// }

exports.Float32ToInt16 = (s32) => {
    // Convert the range [-1, 1] of Float32 in [-32768, 32767] of Int16
    let s16 = Math.floor(((s32 + 1) / 2) * 65535 - 32767);

    // Just for safety
    s16 = Math.min(32767, s16);
    s16 = Math.max(-32768, s16);

    return s16;
}

exports.Int16ToFloat32 = (s16) => {
    // Convert the range [-32768, 32767] of Int16 in [-1, 1] of Float32
    let s32 = ((s16 + 32767) / 65535) * 2 - 1;

    // Just for safety
    s32 = Math.min(1, s32);
    s32 = Math.max(-1, s32);

    return s32;
}
