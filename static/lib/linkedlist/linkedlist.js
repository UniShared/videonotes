function LinkedList() {
    if (!(this instanceof arguments.callee)) {
        throw new Error("Constructor called as a function");
    }

    //private members
    var _nodes = [],
        _head = null,
        _tail = null;

    function Node(value) {
        var _previous = null,
            _next = null,
            _value = value;

        this.getNext = function () {
            return _next;
        };
        this.setNext = function (node) {
            _next = node
        };
        this.hasNext = function () {
            return _next !== null;
        };
        this.getPrevious = function () {
            return _previous;
        };
        this.setPrevious = function (node) {
            _previous = node;
        };
        this.hasPrevious = function () {
            return _previous !== null;
        };
        this.getValue = function () {
            return _value;
        };
        this.asReadOnlyNode = function () {
            return {
                getValue: function () {
                    return _value;
                },
                hasPrevious: function () {
                    return _previous !== null;
                },
                getPrevious: function () {
                    return _previous == null ? null : _previous.asReadOnlyNode();
                },
                hasNext: function () {
                    return _next !== null;
                },
                getNext: function () {
                    return _next == null ? null : _next.asReadOnlyNode();
                }
            };
        }
    }

    function _findByValue(value) {
        for (var i = 0, len = _nodes.length; i < len; i++) {
            if (_nodes[i].getValue() == value)
                return _nodes[i];
        }
        return null;
    }

    //public members

    this.size = function () {
        return _nodes.length;
    }

    this.add = function (val) {
        var newNode = new Node(val);
        if (_tail != null) {
            newNode.setPrevious(_tail);
            _tail.setNext(newNode);
        }
        _tail = newNode;

        if (_head == null)
            _head = newNode;

        _nodes.push(newNode);
        return this;
    }

    this.getHead = function () {
        return _head.asReadOnlyNode();
    }

    this.getTail = function () {
        return _tail.asReadOnlyNode();
    }

    this.findByValue = function (value) {
        var node = _findByValue(value);
        if (node)
            return node.asReadOnlyNode();
        return null;
    }

    this.insertAfter = function (value, newValue) {
        var prevNode = _findByValue(value),
            nextNode,
            newNode;

        if (prevNode == null)
            return null;

        newNode = new Node(newValue);

        nextNode = prevNode.getNext();
        newNode.setNext(nextNode);
        newNode.setPrevious(prevNode);
        prevNode.setNext(newNode);

        if (nextNode != null)
            nextNode.setPrevious(newNode);

        _nodes.push(newNode);
        return newNode.asReadOnlyNode();
    }

    this.asArray = function () {
        var array = [];
        for (var i = 0, len = _nodes.length; i < len; i++) {
            array.push(_nodes[i].getValue());
        }
        return array;
    }

}
