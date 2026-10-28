"use client";

import { createContext, useContext } from "react";
import type { Peptide, ZoneId } from "@/lib/catalog";

export interface LibraryActions {
  openPeptide: (p: Peptide) => void;
  /** undefined: back to the peptide's own zone; null: back to the library without a zone */
  closeDetail: (zone?: ZoneId | null) => void;
  pickZone: (z: ZoneId, toggle?: boolean) => void;
}

const noop = () => {};
export const LibraryContext = createContext<LibraryActions>({ openPeptide: noop, closeDetail: noop, pickZone: noop });
export const useLibrary = () => useContext(LibraryContext);
