/** @jest-environment node */
import { readDueDate } from "./dateWords";

// A Monday, so every weekday answer below is easy to check by counting forward.
const TODAY = "2026-09-14";

describe("readDueDate", () => {
  it.each([
    ["call the bank today", "call the bank", "2026-09-14"],
    ["call the bank tonight", "call the bank", "2026-09-14"],
    ["call the bank tomorrow", "call the bank", "2026-09-15"],
    ["pick a hosting plan fri", "pick a hosting plan", "2026-09-18"],
    ["pick a hosting plan friday", "pick a hosting plan", "2026-09-18"],
    ["pick a hosting plan FRIDAY", "pick a hosting plan", "2026-09-18"],
    ["gym mon", "gym", "2026-09-14"],
    ["gym tue", "gym", "2026-09-15"],
    ["gym sun", "gym", "2026-09-20"],
    ["renew the domain sep 20", "renew the domain", "2026-09-20"],
    ["renew the domain Sept 20", "renew the domain", "2026-09-20"],
    ["renew the domain September 20", "renew the domain", "2026-09-20"],
    ["renew the domain sep. 20", "renew the domain", "2026-09-20"],
    ["renew the domain sep 20th", "renew the domain", "2026-09-20"],
    ["book the flight jan 3", "book the flight", "2027-01-03"],
    ["call the bank on friday", "call the bank", "2026-09-18"],
    ["call the bank by friday", "call the bank", "2026-09-18"],
    ["call the bank due friday", "call the bank", "2026-09-18"],
    ["call the bank due by friday", "call the bank", "2026-09-18"],
    ["  call the bank   tomorrow  ", "call the bank", "2026-09-15"],
  ])("reads %s", (line, title, due) => {
    expect(readDueDate(line, TODAY)).toEqual({ title, due });
  });

  it.each([
    ["nothing that looks like a date", "write the about page"],
    ["a numeric date, which means different days in different countries", "call the bank 9/10"],
    ["a date word that isn't at the end", "tomorrow call the bank"],
    ["a day that doesn't exist", "call the bank feb 30"],
    ["a day that doesn't exist in that month", "call the bank apr 31"],
    ["a month with no day after it", "think about september"],
    ["a word that only starts like a weekday", "monitor the logs"],
    ["a word that only starts like a month", "march through the checklist"],
    ["a date word inside another word", "buy a satnav"],
  ])("leaves %s alone", (_name, line) => {
    expect(readDueDate(line, TODAY)).toEqual({ title: line.trim(), due: null });
  });

  it("is a date on its own line, with nothing left over", () => {
    expect(readDueDate("tomorrow", TODAY)).toEqual({ title: "", due: "2026-09-15" });
  });

  it("counts today when the weekday is today", () => {
    expect(readDueDate("gym monday", TODAY).due).toBe(TODAY);
  });

  it("rolls a month and day that has been and gone into next year", () => {
    expect(readDueDate("renew the domain sep 1", TODAY).due).toBe("2027-09-01");
  });
});
