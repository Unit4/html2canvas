var log = require('./log');

function restoreOwnerScroll(ownerDocument, x, y) {
    if (ownerDocument.defaultView && (x !== ownerDocument.defaultView.pageXOffset || y !== ownerDocument.defaultView.pageYOffset)) {
        ownerDocument.defaultView.scrollTo(x, y);
    }
}

function cloneCanvasContents(canvas, clonedCanvas) {
    try {
        if (clonedCanvas) {
            clonedCanvas.width = canvas.width;
            clonedCanvas.height = canvas.height;
            clonedCanvas.getContext("2d").putImageData(canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height), 0, 0);
        }
    } catch(e) {
        log("Unable to copy canvas content from", canvas, e);
    }
}

function cloneNode(node, javascriptEnabled) {
    var clone = node.nodeType === 3 ? document.createTextNode(node.nodeValue) : node.cloneNode(false);

    var child = node.firstChild;
    while(child) {
        if (javascriptEnabled === true || child.nodeType !== 1 || child.nodeName !== 'SCRIPT') {
            clone.appendChild(cloneNode(child, javascriptEnabled));
        }
        child = child.nextSibling;
    }

    if (node.nodeType === 1) {
		var _scrollTopAttr = document.createAttribute('_scrolltop');
		_scrollTopAttr.value = node.scrollTop;
		clone.setAttributeNode(_scrollTopAttr);

		var _scrollTopLeft = document.createAttribute('_scrollleft');
		_scrollTopLeft.value = node.scrollLeft;
		clone.setAttributeNode(_scrollTopLeft);

		
        if (node.nodeName === "CANVAS") {
            cloneCanvasContents(node, clone);
		} else if (node.nodeName === "INPUT" || node.nodeName === "TEXTAREA" || node.nodeName === "SELECT") {
			var _valueAttr = document.createAttribute('_value');
			_valueAttr.value = node.value;
			clone.setAttributeNode(_valueAttr);
        }
    }

    return clone;
}

function initNode(node) {
    if (node.nodeType === 1) {
		node.scrollTop = node.getAttributeNode('_scrolltop').value;
        node.scrollLeft = node.getAttributeNode('_scrollleft').value;
		
		if (node.nodeName === "INPUT" || node.nodeName === "TEXTAREA" || node.nodeName === "SELECT") {
			node.value = node.getAttributeNode('_value').value;
		}
		
        var child = node.firstChild;
        while(child) {
            initNode(child);
            child = child.nextSibling;
        }
    }
}

function replaceExistingIframes(ownerDocument, documentElement, documentClone) {
    var parentId,
        parentIframeOriginal,
        parentIframeCloned,
        iframeOriginal,
        iframeCloned;

    Array.prototype.forEach.call(documentElement.querySelectorAll('iframe'), function (iframeCopied) {
        var iframeCopiedId = iframeCopied.id;

        if (iframeCopiedId !== 'html2canvascontainer') {
            parentId = iframeCopied.parentNode.id;
            parentIframeOriginal = ownerDocument.getElementById(parentId);
			if(parentIframeOriginal){
				parentIframeCloned = cloneNode(parentIframeOriginal);

				iframeOriginal = retrieveOriginalIframe(ownerDocument, iframeCopiedId, iframeCopied.name);
				if (iframeOriginal) {
					iframeCloned = cloneNode(iframeOriginal.contentDocument.body);
				}

				iframeCopied.appendChild(iframeCloned);        
				
				replaceExistingFramesets(documentClone, iframeOriginal, parentIframeCloned, iframeCopied, frames);
			}
        }
    });    
}

function replaceExistingFramesets(documentClone, iframeOriginal, parentIframeCloned, iframeCopied, frames) {
    var existingFrames;

    Array.prototype.forEach.call(iframeCopied.querySelectorAll('frameset'), function (frameset) {
        existingFrames = frameset.querySelectorAll('frame');
        replaceExistingFrames(documentClone, iframeOriginal, parentIframeCloned, iframeCopied, existingFrames);
    });
}

function replaceExistingFrames(documentClone, iframeOriginal, parentIframeCloned, iframeCopied, existingFrames) {
    var contentContainerFrame,
        htmlElement,
        frameClonedHead,
        frameClonedBody,
        nodeToReplace;

    Array.prototype.forEach.call(existingFrames, function (frame) {
        frame.src = '';

        if (frame.name === 'contentcontainer') {
            contentContainerFrame = iframeOriginal.contentDocument.body.querySelector('#contentContainerFrame');

            htmlElement = documentClone.createElement("html");
            frameClonedHead = cloneNode(contentContainerFrame.contentDocument.head);            
            frameClonedBody = cloneNode(contentContainerFrame.contentDocument.body);
            htmlElement.appendChild(frameClonedHead);
            htmlElement.appendChild(frameClonedBody);

            nodeToReplace = documentClone.getElementById(parentIframeCloned.id);
            nodeToReplace.innerHTML = htmlElement.innerHTML;
        }
    });
}

function retrieveOriginalIframe(ownerDocument, iframeId, iframeName) {
    if (iframeId !== "") {
        return ownerDocument.getElementById(iframeId);
    } else if (iframeName !== "") {
        return ownerDocument.getElementsByName(iframeName)[0];
    } else {
        return null;
    }
}

module.exports = function(ownerDocument, containerDocument, width, height, options, x ,y) {
    var documentElement = cloneNode(ownerDocument.documentElement, options.javascriptEnabled);
    var container = containerDocument.createElement("iframe");

    container.className = "html2canvas-container";
	container.id = "html2canvascontainer";
    container.style.visibility = "hidden";
    container.style.position = "fixed";
    container.style.left = "-10000px";
    container.style.top = "0px";
    container.style.border = "0";
    container.width = width;
    container.height = height;
    container.scrolling = "no"; // ios won't scroll without it
    containerDocument.body.appendChild(container);

    return new Promise(function(resolve) {
        var documentClone = container.contentWindow.document;

        /* Chrome doesn't detect relative background-images assigned in inline <style> sheets when fetched through getComputedStyle
         if window url is about:blank, we can assign the url to current by writing onto the document
         */
        container.contentWindow.onload = container.onload = function() {
            var interval = setInterval(function() {
                if (documentClone.body.childNodes.length > 0) {
                    initNode(documentClone.documentElement);
                    clearInterval(interval);
                    if (options.type === "view") {
                        container.contentWindow.scrollTo(x, y);
                        if ((/(iPad|iPhone|iPod)/g).test(navigator.userAgent) && (container.contentWindow.scrollY !== y || container.contentWindow.scrollX !== x)) {
                            documentClone.documentElement.style.top = (-y) + "px";
                            documentClone.documentElement.style.left = (-x) + "px";
                            documentClone.documentElement.style.position = 'absolute';
                        }
                    }
                    resolve(container);
                }
            }, 50);
        };

        documentClone.open();        
		documentClone.write(documentElement.outerHTML);
		replaceExistingIframes(ownerDocument, documentElement, documentClone);
        documentClone.close();
    });
};
