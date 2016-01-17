/**
 * This is a JSX version of shellinford library:
 * https://code.google.com/p/shellinford/
 *
 * License: http://shibu.mit-license.org/
 */

import "./bit-vector.jsx";
import "./binary-io.jsx";

__export__ class WaveletMatrix
{
    var _bv : BitVector[];
    var _seps : int[];
    var _range : Map.<int>;
    var _maxcharcode : int;
    var _bitsize : int;
    var _usedChars : Map.<boolean>;
    var _size : int;

    function constructor ()
    {
        this._range = {} : Map.<int>;
        this._bv = [] : BitVector[];
        this._seps = [] : int[];
        this._maxcharcode = 65535;
        this._bitsize = 16;
        this._usedChars = {} : Map.<boolean>;
        this.clear();
    }

    function bitsize () : int
    {
        return this._bitsize;
    }

    function setMaxCharCode (charCode : int) : void
    {
        this._maxcharcode = charCode;
        this._bitsize = Math.ceil(Math.log(this._maxcharcode) / Math.LN2);
    }

    function maxCharCode () : int
    {
        return this._maxcharcode;
    }

    function usedChars () : int[]
    {
        var chars = [] : int[];
        for (var charCode in this._usedChars)
        {
            if (this._usedChars.hasOwnProperty(charCode))
            {
                chars.push(charCode as int);
            }
        }
        return chars;
    }

    function clear () : void
    {
        this._bv.length = 0;
        this._seps.length = 0;
        this._size = 0;
    }

    function build (v : string) : void
    {
        this.clear();
        var size = v.length;
        var bitsize = this.bitsize();
        for (var i = 0; i < bitsize; i++)
        {
            this._bv.push(BitVector.create(size));
            this._seps.push(0);
        }
        this._size = size;
        for (var i = 0; i < size; i++)
        {
            var charCode = v.charCodeAt(i);
            this._uint2bit(charCode, 0) ?  this._bv[0].set1(i) : this._bv[0].set0(i);
            this._usedChars[charCode as string] = true;
        }
        this._bv[0].build();
        this._seps[0] = this._bv[0].size0();
        this._range[0 as string] = 0;
        this._range[1 as string] = this._seps[0];

        var depth : int = 1;
        while (depth < bitsize)
        {
            var range_tmp = this._shallow_copy(this._range); // copy
            for (var i = 0; i < size; i++)
            {
                var code = v.charCodeAt(i);
                var bit = this._uint2bit(code, depth);
                var key = code >>> (bitsize - depth);
                bit ? this._bv[depth].set1(range_tmp[key as string]) : this._bv[depth].set0(range_tmp[key as string]);
                range_tmp[key as string]++;
            }
            this._bv[depth].build();
            this._seps[depth] = this._bv[depth].size0();

            var range_rev = {} : Map.<int>;
            for (var range_key in this._range)
            {
                var value : int = this._range[range_key];
                if (value != range_tmp[range_key])
                {
                    range_rev[value as string] = range_key as int;
                }
            }
            this._range = {} : Map.<int>;
            var pos0 = 0;
            var pos1 = this._seps[depth];
            var keys = this._sortKeys(range_rev);
            for (var i = 0; i < keys.length; i++)
            {
                var begin = keys[i];
                var value = range_rev[begin as string];
                var end = range_tmp[value as string];
                var num0  = this._bv[depth].rank0(end) -
                            this._bv[depth].rank0(begin);
                var num1  = end - begin - num0;
                if (num0 > 0)
                {
                    this._range[(value << 1) as string] = pos0;
                    pos0 += num0;
                }
                if (num1 > 0)
                {
                    this._range[((value << 1) + 1) as string] = pos1;
                    pos1 += num1;
                }
            }
            depth++;
        }
    }

    function _sortKeys (map : Map.<int>) : int[]
    {
        var keys = [] : int[];
        for (var key in map)
        {
            if (map.hasOwnProperty(key))
            {
                keys.push(key as int);
            }
        }
        keys.sort((a, b) -> { return a - b; });
        return keys;
    }

    function size () : int
    {
        return this._size;
    }

    function count (c : int) : int
    {
        return this.rank(this.size(), c);
    }

    function get (i : int) : int
    {
        if (i >= this.size())
        {
            throw new Error("WaveletMatrix.get() : range error");
        }
        var value = 0;
        var depth = 0;
        while (depth < this.bitsize())
        {
            var bit = this._bv[depth].get(i);
            i = bit ? this._bv[depth].rank1(i) : this._bv[depth].rank0(i);
            value <<= 1;
            if (bit)
            {
                i += this._seps[depth];
                value += 1;
            }
            depth++;
        }
        return value;
    }

    function rank (i : int, c : int) : int
    {
        if (i > this.size())
        {
            throw new Error("WaveletMatrix.rank(): range error");
        }
        if (i == 0)
        {
            return 0;
        }

        var begin = this._range[c as string];
        if (begin == null)
        {
            return 0;
        }
        var end   = i;
        var depth = 0;
        while (depth < this.bitsize())
        {
            var bit = this._uint2bit(c, depth);
            end = bit ? this._bv[depth].rank1(end) : this._bv[depth].rank0(end);
            if (bit)
            {
                end += this._seps[depth];
            }
            depth++;
        }
        return end - begin;
    }

    function rankLessThan (i : int, c : int) : int
    {
        if (i > this.size())
        {
            throw new Error("WaveletMatrix.rank_less_than(): range error");
        }
        if (i == 0)
        {
            return 0;
        }

        var begin = 0;
        var end   = i;
        var depth = 0;
        var rlt   = 0;
        while (depth < this.bitsize())
        {
            var rank0_begin = this._bv[depth].rank0(begin);
            var rank0_end   = this._bv[depth].rank0(end);
            if (this._uint2bit(c, depth))
            {
                rlt += (rank0_end - rank0_begin);
                begin += (this._seps[depth] - rank0_begin);
                end   += (this._seps[depth] - rank0_end);
            }
            else
            {
                begin = rank0_begin;
                end   = rank0_end;
            }
            depth++;
        }
        return rlt;
    }

    function dump (output : BinaryOutput) : void
    {
        output.dump16bitNumber(this._maxcharcode);
        output.dump16bitNumber(this._bitsize);
        output.dump32bitNumber(this._size);
        for (var i = 0; i < this.bitsize(); i++)
        {
            this._bv[i].dump(output);
        }
        for (var i = 0; i < this.bitsize(); i++)
        {
            output.dump32bitNumber(this._seps[i]);
        }
        var counter = 0;
        for (var key in this._range)
        {
            if (this._range.hasOwnProperty(key))
            {
                counter++;
            }
        }
        output.dump32bitNumber(counter);
        for (var key in this._range)
        {
            if (this._range.hasOwnProperty(key))
            {
                output.dump32bitNumber(key as number);
                output.dump32bitNumber(this._range[key]);
            }
        }
    }

    function load (input : BinaryInput) : void
    {
        this.clear();
        this._maxcharcode = input.load16bitNumber();
        this._bitsize = input.load16bitNumber();
        this._size = input.load32bitNumber();
        for (var i = 0; i < this.bitsize(); i++)
        {
            this._bv.push(BitVector.load(input));
        }
        for (var i = 0; i < this.bitsize(); i++)
        {
            this._seps.push(input.load32bitNumber());
        }

        var range_size = input.load32bitNumber();
        for (var i = 0; i < range_size; i++)
        {
            var key = input.load32bitNumber();
            var value = input.load32bitNumber();
            this._range[key as string] = value;
        }
    }

    function _uint2bit (c : int, i : int) : boolean
    {
        return ((c >> (this.bitsize() - 1 - i)) & 0x1) == 0x1;
    }

    function _shallow_copy (input : Map.<int>) : Map.<int>
    {
        var result = {} : Map.<int>;
        for (var key in input)
        {
            result[key] = input[key];
        }
        return result;
    }
}
