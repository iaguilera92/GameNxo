const COURT={left:170,right:1110,top:230,bottom:590};const V={NEAR_Y:1010,FAR_Y:312,NEAR_W:700,RATIO:0.48,CHAR_K:0.58};
const L0=170,L1=1110,LAT_W=360,CAM_X=(L0-V.RATIO*L1)/(1-V.RATIO),D1=L0-CAM_X,D2=L1-CAM_X,F=(V.NEAR_W*D1)/LAT_W,K=(V.NEAR_Y-V.FAR_Y)/(1/D1-1/D2),H0=V.NEAR_Y-K/D1;
const s=0.875,top=302-349*s;
for(const x of [1110+130,1110,1110-150,640,400,170]){const D=x-CAM_X,ps=F/D,h=150*ps*V.CHAR_K,sy=H0+K/D+52;console.log('x',x,'pantallaY',sy.toFixed(0),'alto mundo',h.toFixed(0),'alto en pantalla',(h*0.85).toFixed(0),'img1536 y',((sy-top)/s).toFixed(0),'alto img1536',(h/s).toFixed(0),'img1254 y',((sy-top)/s/1.2249).toFixed(0),'alto img1254',(h/s/1.2249).toFixed(0))}
