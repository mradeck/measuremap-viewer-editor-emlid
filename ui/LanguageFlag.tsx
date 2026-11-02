import React,{useId} from 'react';
import type {Language} from './translations';
/** Vector flags (identical to the shared public-app design) avoid OS-dependent emoji support, especially on Windows. */
export default function LanguageFlag({language}:{language:Language}){
  const clip=`gb-clip-${useId().replace(/[^a-zA-Z0-9_-]/g,'')}`;
  if(language==='de')return <svg className="language-flag" viewBox="0 0 30 20" aria-hidden="true" focusable="false" data-country="DE"><path fill="#000" d="M0 0h30v7H0z"/><path fill="#d00" d="M0 7h30v6H0z"/><path fill="#ffce00" d="M0 13h30v7H0z"/></svg>;
  return <svg className="language-flag" viewBox="0 0 60 40" aria-hidden="true" focusable="false" data-country="GB"><defs><clipPath id={clip}><path d="M0 0h60v40H0z"/></clipPath></defs><g clipPath={`url(#${clip})`}><path fill="#012169" d="M0 0h60v40H0z"/><path stroke="#fff" strokeWidth="8" d="m0 0 60 40M0 40 60 0"/><path stroke="#c8102e" strokeWidth="3" d="m0 0 60 40M0 40 60 0"/><path stroke="#fff" strokeWidth="13" d="M30 0v40M0 20h60"/><path stroke="#c8102e" strokeWidth="8" d="M30 0v40M0 20h60"/></g></svg>;
}
