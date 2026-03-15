export function initRipple(): () => void {
  function handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const button = target.closest('button');
    if (!button) return;

    // Ensure the button can contain the ripple
    const computedPosition = window.getComputedStyle(button).position;
    if (computedPosition === 'static') {
      button.style.position = 'relative';
    }
    button.style.overflow = 'hidden';

    const rect = button.getBoundingClientRect();
    const diameter = Math.max(rect.width, rect.height) * 2;
    const radius = diameter / 2;

    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    ripple.style.width = `${diameter}px`;
    ripple.style.height = `${diameter}px`;
    ripple.style.left = `${event.clientX - rect.left - radius}px`;
    ripple.style.top = `${event.clientY - rect.top - radius}px`;

    button.appendChild(ripple);

    ripple.addEventListener('animationend', () => {
      ripple.remove();
    });
  }

  document.addEventListener('click', handleClick);

  return () => {
    document.removeEventListener('click', handleClick);
  };
}
