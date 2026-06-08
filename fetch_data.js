import fs from "fs";

async function run() {
  try {
    const res = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vQgbLymOhUPywO3s0Rq-ThI-X9itRvHbxgerC1DhSsjkpjXDU1uXXV1N_ybnN3eMfBKM4wMDro-VlsH/pub?output=csv");
    const text = await res.text();
    console.log(text.substring(0, 2000));
  } catch (e) {
    console.error(e);
  }
}

run();
