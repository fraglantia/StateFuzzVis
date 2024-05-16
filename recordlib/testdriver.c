#include "./statefuzzvis.h"

int main() {
  char *string_database[4]={'\0'};
    string_database[0]="Florida";
    string_database[1]="Oregon";
    string_database[2]="California";
    string_database[3]="Georgia";

  write_statefuzzvis_record(
    "record_fname",
    string_database,
    4,
    "example_seed"
  );
  return 0;
}
