#ifndef _STATEFUZZVIS_H_
#define _STATEFUZZVIS_H_

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>

static const unsigned char base64_table[65] =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * base64_encode - Base64 encode
 * https://web.mit.edu/freebsd/head/contrib/wpa/src/utils/base64.c
 * @src: Data to be encoded
 * @len: Length of the data to be encoded
 * @out_len: Pointer to output length variable, or %NULL if not used
 * Returns: Allocated buffer of out_len bytes of encoded data,
 * or %NULL on failure
 *
 * Caller is responsible for freeing the returned buffer. Returned buffer is
 * nul terminated to make it easier to use as a C string. The nul terminator is
 * not included in out_len.
 */
unsigned char * base64_encode(const unsigned char *src, size_t len,
			      size_t *out_len)
{
	unsigned char *out, *pos;
	const unsigned char *end, *in;
	size_t olen;
	int line_len;

	olen = len * 4 / 3 + 4; /* 3-byte blocks to 4-byte */
	olen += olen / 72; /* line feeds */
	olen++; /* nul termination */
	if (olen < len)
		return NULL; /* integer overflow */
	out = (unsigned char*) malloc(olen);
	if (out == NULL)
		return NULL;

	end = src + len;
	in = src;
	pos = out;
	line_len = 0;
	while (end - in >= 3) {
		*pos++ = base64_table[in[0] >> 2];
		*pos++ = base64_table[((in[0] & 0x03) << 4) | (in[1] >> 4)];
		*pos++ = base64_table[((in[1] & 0x0f) << 2) | (in[2] >> 6)];
		*pos++ = base64_table[in[2] & 0x3f];
		in += 3;
		line_len += 4;
		if (line_len >= 72) {
			*pos++ = '\n';
			line_len = 0;
		}
	}

	if (end - in) {
		*pos++ = base64_table[in[0] >> 2];
		if (end - in == 1) {
			*pos++ = base64_table[(in[0] & 0x03) << 4];
			*pos++ = '=';
		} else {
			*pos++ = base64_table[((in[0] & 0x03) << 4) |
					      (in[1] >> 4)];
			*pos++ = base64_table[(in[1] & 0x0f) << 2];
		}
		*pos++ = '=';
		line_len += 4;
	}

	if (line_len)
		*pos++ = '\n';

	*pos = '\0';
	if (out_len)
		*out_len = pos - out;
	return out;
}

void write_statefuzzvis_record(char* fname, char** states, int state_count, char* seed_buf) {
    // large enough buffer
    // Format
    // state1$$$state2$$$state3
    // YW5ueWVvbmdoYXNleW9taWNjaHk=
    size_t b64_len = 0;
    unsigned char * out = (unsigned char *) malloc(0x10000);
    unsigned char * b64seed = base64_encode(seed_buf, strlen(seed_buf), &b64_len);
    
    int ptr = 0;
    for (int i=0; i<state_count; i++) {
        if (i != 0) {
            out[ptr++] = '$'; out[ptr++] = '$'; out[ptr++] = '$';
        }
        int cur_len = strlen(states[i]);
        strcpy(out+ptr, states[i]);
        ptr += cur_len;
    }
    out[ptr++] = '\n';
    strcpy(out+ptr, b64seed);
    ptr += b64_len;

    FILE* file = fopen(fname, "w");
    if(!file) perror("Cannot open the file.\n");
    fwrite(out, 1, strlen(out), file);
    fclose(file);
}

#endif
