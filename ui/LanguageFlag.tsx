import React from 'react';
import type {Language} from './translations';
/** Vector flags avoid OS-dependent emoji support, especially on Windows. */
export default function LanguageFlag({language}:{language:Language}){
  return <svg className="language-flag" viewBox="0 0 30 20" aria-hidden="true" focusable="false" data-country={language==='de'?'DE':'GB'}>
    {language==='de'?<><path fill="#000" d="M0 0h30v7H0z"/><path fill="#dd0000" d="M0 6.667h30v6.666H0z"/><path fill="#ffce00" d="M0 13.333h30V20H0z"/></>:<>
      <path fill="#012169" d="M0 0h30v20H0z"/>
      <path stroke="#fff" strokeWidth="4" d="m0 0 30 20M30 0 0 20"/>
      <path fill="#c8102e" d="M0 0v1.49L12.765 10H15L0 0Zm30 0h-2.235L15 8.51V10L30 0ZM0 20h2.235L15 11.49V10L0 20Zm30 0v-1.49L17.235 10H15l15 10Z"/>
      <path stroke="#fff" strokeWidth="6" d="M15 0v20M0 10h30"/>
      <path stroke="#c8102e" strokeWidth="4" d="M15 0v20M0 10h30"/>
    </>}
  </svg>;
}
