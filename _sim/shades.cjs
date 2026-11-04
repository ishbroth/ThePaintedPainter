const sharp = require('sharp');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600">
<defs>
 <linearGradient id="lens" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#3b4350"/><stop offset="0.45" stop-color="#0d1015"/><stop offset="1" stop-color="#05060a"/></linearGradient>
 <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
 <filter id="soft"><feGaussianBlur stdDeviation="0.8"/></filter>
 <filter id="shadow"><feGaussianBlur stdDeviation="2.5"/></filter>
</defs>
<g transform="rotate(-3.2 775 613)">
 <!-- soft shadow on the face -->
 <g filter="url(#shadow)" opacity="0.35" transform="translate(2,6)">
  <ellipse cx="727" cy="617" rx="36" ry="27" fill="#000"/><ellipse cx="823" cy="617" rx="36" ry="27" fill="#000"/>
 </g>
 <!-- temples to the ears -->
 <path d="M690 606 L654 598" stroke="#14171c" stroke-width="5" stroke-linecap="round" fill="none"/>
 <path d="M859 606 L892 598" stroke="#14171c" stroke-width="5" stroke-linecap="round" fill="none"/>
 <!-- bridge -->
 <path d="M762 606 Q775 598 788 606" stroke="#14171c" stroke-width="4.5" fill="none" stroke-linecap="round"/>
 <!-- lenses (aviator shape) -->
 <g filter="url(#soft)">
  <path d="M692 602 Q727 594 762 602 Q764 640 742 646 Q714 650 698 632 Q690 618 692 602Z" fill="url(#lens)" stroke="#14171c" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="M788 602 Q823 594 858 602 Q860 618 852 632 Q836 650 808 646 Q786 640 788 602Z" fill="url(#lens)" stroke="#14171c" stroke-width="4.5" stroke-linejoin="round"/>
 </g>
 <path d="M700 604 Q720 600 738 603 L712 628 Q702 618 700 604Z" fill="url(#shine)"/>
 <path d="M796 604 Q816 600 834 603 L808 628 Q798 618 796 604Z" fill="url(#shine)"/>
</g></svg>`;
sharp('_sim/hero-collage-original.jpg').composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 88 }).toFile('_sim/hero-shades.jpg')
 .then(() => sharp('_sim/hero-shades.jpg').extract({left:560,top:500,width:440,height:240}).resize(1100).toFile('_sim/shots/shades.png')).then(()=>console.log('ok'));
