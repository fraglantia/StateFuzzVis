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
	while (end - in >= 3) {
		*pos++ = base64_table[in[0] >> 2];
		*pos++ = base64_table[((in[0] & 0x03) << 4) | (in[1] >> 4)];
		*pos++ = base64_table[((in[1] & 0x0f) << 2) | (in[2] >> 6)];
		*pos++ = base64_table[in[2] & 0x3f];
		in += 3;
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
	}

	*pos = '\0';
	if (out_len)
		*out_len = pos - out;
	return out;
}

void write_statefuzzvis_record(char* fname, char** states, int state_count, char* seed_buf, int seed_buf_len) {
    // large enough buffer
    // Format
    // state1$$$state2$$$state3
    // YW5ueWVvbmdoYXNleW9taWNjaHk=
    size_t b64_len = 0;
    unsigned char * out = (unsigned char *) malloc(0x10000);
	if (seed_buf_len > 0x4000) {
		seed_buf_len = 0x4000;
		seed_buf[0x4000-3] = '.';
		seed_buf[0x4000-2] = '.';
		seed_buf[0x4000-1] = '.';
		seed_buf[0x4000] = '.';
	}
    unsigned char * b64seed = base64_encode(seed_buf, seed_buf_len, &b64_len);
    
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

void write_statefuzzvis_record_int(char* fname, int* states, int state_count, char* seed_buf, int seed_buf_len) {
    char** char_states = (char**) malloc(sizeof(char*) * state_count);
	for (int i=0; i<state_count;i++) {
		char_states[i] = (char*) malloc(16);
		snprintf(char_states[i], 16, "%d", states[i]);
	}
	write_statefuzzvis_record(fname, char_states, state_count, seed_buf, seed_buf_len);
}

#endif