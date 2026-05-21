const socket = io();
const chess = new Chess();
const chessboard = document.querySelector('.chessboard');

let draggedPiece = null;
let sourceSquare =null;
let playerRole = null;

const renderBoard = () => {
    const board = chess.board();
    chessboard.innerHTML ="";
    if(playerRole === 'b'){
        chessboard.classList.add('flipped');
    } else {
        chessboard.classList.remove('flipped');
    }
    board.forEach((row, rowIndex) => {
        row.forEach((square, squareIndex) => {
           const squareElement= document.createElement('div');
           squareElement.classList.add('square',
            (rowIndex + squareIndex)%2 == 0 ? 'light' : 'dark'
           );

squareElement.dataset.row =rowIndex;
squareElement.dataset.col =squareIndex;


        if(square){
            const pieceElement = document.createElement('div');
            pieceElement.classList.add(
                "piece",
                square.color==='w'?'white':'black'
            );
            pieceElement.innerText=getPieceUnicode(square);
            pieceElement.draggable=playerRole === square.color;
            pieceElement.addEventListener('dragstart', (e) => {
                if(pieceElement.draggable){
                    draggedPiece = pieceElement;
                    sourceSquare ={row:rowIndex, col:squareIndex};

                    e.dataTransfer.setData("text/plain", "");


                }
            }
            );

            pieceElement.addEventListener('dragend', (e) => {
                draggedPiece = null;
                sourceSquare = null;
            });
            squareElement.appendChild(pieceElement);

        }

        squareElement.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        squareElement.addEventListener('drop', (e) => {
            e.preventDefault();
            if(draggedPiece){
                const targetSource ={
                    row:Number.parseInt(squareElement.dataset.row),
                    col: Number.parseInt(squareElement.dataset.col)
                };
                handleMove(sourceSquare,targetSource);
                }
            });
            chessboard.appendChild(squareElement);
        }); 
        
    });
   
};


const handleMove = (source, target) => {

    const move = {

        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,

        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,

        promotion: "q"
    };

    socket.emit("move", move);
};

const getPieceUnicode =(piece) => {
    const unicodePieces={
         p: piece.color === "w" ? "♙" : "♟",
        r: piece.color === "w" ? "♖" : "♜",
        n: piece.color === "w" ? "♘" : "♞",
        b: piece.color === "w" ? "♗" : "♝",
        q: piece.color === "w" ? "♕" : "♛",
        k: piece.color === "w" ? "♔" : "♚"
    };

       
     
     return unicodePieces[ piece.type] || '';
    };

    socket.on("playerRole", function(role){

    console.log("ROLE:", role);

    playerRole = role;

    renderBoard();
});
    socket.on("boardState", function(fen){

    chess.load(fen);

    renderBoard();
});
socket.on("spectatorRole", function(){

    playerRole = null;

    renderBoard();
});

renderBoard();


