type IconName = 'arrow_back' | 'arrow_forward' | 'close' | 'keyboard_arrow_down';

export function Icon({name}: {name: IconName}) {
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <use href={`/icons/material-symbols.svg#${name}`} width="24" height="24"/>
  </svg>;
}
