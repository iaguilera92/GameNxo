const COURT={left:170,right:1110};const V={NEAR_Y:1010,FAR_Y:312,NEAR_W:700,RATIO:0.48,CHAR_K:0.58};
const L0=170,L1=1110,CAM_X=(L0-V.RATIO*L1)/(1-V.RATIO),D1=L0-CAM_X,D2=L1-CAM_X,F=(V.NEAR_W*D1)/360,K=(V.NEAR_Y-V.FAR_Y)/(1/D1-1/D2),H0=V.NEAR_Y-K/D1;
const s=0.875,top=302-350*s; const out=[];
for(const [x,y] of [[386,394],[331,361],[1164,408]]){const sy=top+y*s;const D=K/(sy-52-H0);const h=150*(F/D)*V.CHAR_K*0.7;console.log(x,y,'sentado mundo',h.toFixed(0),'pantalla',(h*0.85).toFixed(0),'img1536',(h/s).toFixed(0));out.push([x,y,+(h/s).toFixed(0)]);}
console.log(JSON.stringify(out));
